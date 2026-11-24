import * as THREE from 'three';
import {
  getQuaternionForFace,
  type DieFaceInfo,
  type PolyhedralDieSides,
} from './dice3DGeometry';

export interface Dice3DBounds {
  halfW: number;
  halfH: number;
}

export type DiceImpactKind = 'floor' | 'wall' | 'die';

export interface DicePhysicsCallbacks {
  onDieSettled?: (body: Dice3DBody) => void;
  onImpact?: (intensity: number, kind: DiceImpactKind) => void;
}

export interface Dice3DBody {
  id: string;
  dieId: string;
  sides: PolyhedralDieSides;
  color: string;
  isCompanion: boolean;
  radius: number;

  // World position on the 2.5D tabletop plane (Z >= 0 is height above screen plane)
  pos: THREE.Vector3;
  vel: THREE.Vector3;

  // Rotation & angular velocity
  quat: THREE.Quaternion;
  angVel: THREE.Vector3;

  // Target face to settle smoothly onto after rolling
  faces: DieFaceInfo[];
  targetValue: number;
  targetQuat: THREE.Quaternion;
  isRolling: boolean;
  rollTimer: number;
  settleDuration: number;
  isDragging: boolean;
  isHovered: boolean;
  settled: boolean;

  // Optional smooth spring-damped home glide target (cleared on arrival or grab)
  gatherTarget: THREE.Vector2 | null;
}

// Reusable scratch math objects (Zero GC inside render/physics ticks)
const _deltaQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _zUnit = new THREE.Vector3(0, 0, 1);
const _diff = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _tangent = new THREE.Vector3();

const GRAVITY = -38; // Pulls Z height crisply down to tabletop (Z = 0)
const RESTITUTION_WALL = 0.64;
const RESTITUTION_FLOOR = 0.44;
const RESTITUTION_DIE = 0.62;
const LINEAR_DRAG_AIR = 0.9;
const LINEAR_DRAG_FLOOR = 3.1;
const ANGULAR_DRAG = 3.8;
const PHYSICS_SUBSTEPS = 2;

export function findFaceForValue(faces: DieFaceInfo[], value: number): DieFaceInfo {
  return faces.find((f) => f.value === value) || faces[0];
}

export function createDice3DBody(params: {
  id: string;
  dieId: string;
  sides: PolyhedralDieSides;
  color: string;
  isCompanion: boolean;
  radius: number;
  faces: DieFaceInfo[];
  x: number;
  y: number;
  initialValue?: number;
}): Dice3DBody {
  const initialValue = params.initialValue ?? params.sides;
  const face = findFaceForValue(params.faces, initialValue);
  const startQuat = getQuaternionForFace(face);

  return {
    id: params.id,
    dieId: params.dieId,
    sides: params.sides,
    color: params.color,
    isCompanion: params.isCompanion,
    radius: params.radius,
    pos: new THREE.Vector3(params.x, params.y, 0),
    vel: new THREE.Vector3(0, 0, 0),
    quat: startQuat.clone(),
    angVel: new THREE.Vector3(0, 0, 0),
    faces: params.faces,
    targetValue: initialValue,
    targetQuat: startQuat.clone(),
    isRolling: false,
    rollTimer: 0,
    settleDuration: 0.72,
    isDragging: false,
    isHovered: false,
    settled: true,
    gatherTarget: null,
  };
}

/**
 * Launches a die with energetic spin, toss velocity, and a deterministic target landing face
 * (with subtle organic resting yaw around camera +Z so numbers stay upright yet natural).
 */
export function launchDieBody(
  body: Dice3DBody,
  targetValue: number,
  options?: {
    vx?: number;
    vy?: number;
    vz?: number;
    duration?: number;
    naturalYaw?: boolean;
  }
): void {
  const face = findFaceForValue(body.faces, targetValue);
  body.targetValue = face.value;
  body.targetQuat.copy(getQuaternionForFace(face));

  if (options?.naturalYaw !== false) {
    // Subtle organic tabletop twist (±8°) around camera Z so rolled dice don't look robotically grid-locked
    const yaw = (Math.random() - 0.5) * 0.28;
    _yawQuat.setFromAxisAngle(_zUnit, yaw);
    body.targetQuat.premultiply(_yawQuat).normalize();
  }

  body.gatherTarget = null;
  body.vel.set(
    options?.vx ?? (Math.random() - 0.5) * 14,
    options?.vy ?? (Math.random() - 0.5) * 12,
    options?.vz ?? 8.5 + Math.random() * 4
  );

  // Couple initial tumble spin to toss direction plus energetic random torque
  const rollSpinX = -body.vel.y / Math.max(0.35, body.radius);
  const rollSpinY = body.vel.x / Math.max(0.35, body.radius);
  body.angVel.set(
    rollSpinX * 0.45 + (Math.random() > 0.5 ? 1 : -1) * (9 + Math.random() * 8),
    rollSpinY * 0.45 + (Math.random() > 0.5 ? 1 : -1) * (9 + Math.random() * 8),
    (Math.random() - 0.5) * 7
  );

  body.isRolling = true;
  body.rollTimer = 0;
  body.settleDuration = options?.duration ?? 0.74;
  body.settled = false;
}

/**
 * Smoothly glides a die back to an exact resting home position using exponential damping
 * and upright orientation (used by the "Reunir" command).
 */
export function gatherDieBodyTo(body: Dice3DBody, x: number, y: number): void {
  const face = findFaceForValue(body.faces, body.targetValue);
  body.targetQuat.copy(getQuaternionForFace(face));
  body.isRolling = false;
  body.isDragging = false;
  body.vel.set(0, 0, 5.2);
  body.angVel.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
  body.gatherTarget = new THREE.Vector2(x, y);
  body.settled = false;
}

function stepPhysicsSubstep(
  bodies: Dice3DBody[],
  dt: number,
  bounds: Dice3DBounds,
  callbacks?: DicePhysicsCallbacks
): boolean {
  let anyActive = false;

  const padX = Math.max(1.0, bounds.halfW - 0.65);
  const padY = Math.max(0.9, bounds.halfH - 0.65);

  for (const body of bodies) {
    if (body.isDragging) {
      body.gatherTarget = null;
      body.pos.z = THREE.MathUtils.damp(body.pos.z, 1.35, 14, dt);
      body.settled = false;
      anyActive = true;
      continue;
    }

    // Smoothly damped glide back to exact home coordinates
    if (body.gatherTarget) {
      anyActive = true;
      const targetX = THREE.MathUtils.clamp(body.gatherTarget.x, -padX, padX);
      const targetY = THREE.MathUtils.clamp(body.gatherTarget.y, -padY, padY);

      const prevX = body.pos.x;
      const prevY = body.pos.y;
      body.pos.x = THREE.MathUtils.damp(body.pos.x, targetX, 7.5, dt);
      body.pos.y = THREE.MathUtils.damp(body.pos.y, targetY, 7.5, dt);
      body.vel.x = (body.pos.x - prevX) / dt;
      body.vel.y = (body.pos.y - prevY) / dt;

      if (body.pos.z > 0 || body.vel.z !== 0) {
        body.vel.z += GRAVITY * dt;
        body.pos.z += body.vel.z * dt;
        if (body.pos.z <= 0) {
          body.pos.z = 0;
          if (Math.abs(body.vel.z) > 1.8) {
            body.vel.z = -body.vel.z * 0.28;
            callbacks?.onImpact?.(Math.min(1, Math.abs(body.vel.z) / 14), 'floor');
          } else {
            body.vel.z = 0;
          }
        }
      }

      const slerpAlpha = 1 - Math.exp(-9 * dt);
      body.quat.slerp(body.targetQuat, slerpAlpha);

      const distSq =
        (body.pos.x - targetX) * (body.pos.x - targetX) +
        (body.pos.y - targetY) * (body.pos.y - targetY);
      if (distSq < 0.0004 && body.pos.z <= 0.01 && body.quat.angleTo(body.targetQuat) < 0.015) {
        body.pos.set(targetX, targetY, 0);
        body.vel.set(0, 0, 0);
        body.angVel.set(0, 0, 0);
        body.quat.copy(body.targetQuat);
        body.gatherTarget = null;
        body.settled = true;
      }
      continue;
    }

    if (body.settled && !body.isHovered) {
      body.pos.x = THREE.MathUtils.clamp(body.pos.x, -padX, padX);
      body.pos.y = THREE.MathUtils.clamp(body.pos.y, -padY, padY);
      continue;
    }

    anyActive = true;

    // Gravity on Z height
    if (body.pos.z > 0 || body.vel.z !== 0) {
      body.vel.z += GRAVITY * dt;
    }

    body.pos.addScaledVector(body.vel, dt);

    // Floor bounce (Z = 0 tabletop surface)
    if (body.pos.z < 0) {
      body.pos.z = 0;
      const impactVz = Math.abs(body.vel.z);
      if (impactVz > 1.25) {
        body.vel.z = impactVz * RESTITUTION_FLOOR;
        callbacks?.onImpact?.(Math.min(1, impactVz / 15), 'floor');

        // Floor impact imparts realistic tumble spin coupled to horizontal travel
        const invR = 1 / Math.max(0.35, body.radius);
        body.angVel.x = THREE.MathUtils.lerp(body.angVel.x, -body.vel.y * invR, 0.35) + (Math.random() - 0.5) * 2.8;
        body.angVel.y = THREE.MathUtils.lerp(body.angVel.y, body.vel.x * invR, 0.35) + (Math.random() - 0.5) * 2.8;
      } else {
        body.vel.z = 0;
      }
    }

    // Bounce off the 4 viewport walls
    const maxX = Math.max(0.8, bounds.halfW - body.radius * 1.15);
    const maxY = Math.max(0.8, bounds.halfH - body.radius * 1.15);

    if (body.pos.x > maxX) {
      const impactV = Math.abs(body.vel.x);
      body.pos.x = maxX;
      body.vel.x = -impactV * RESTITUTION_WALL;
      body.angVel.y -= body.vel.x * 0.55;
      body.angVel.z += body.vel.y * 0.22;
      if (impactV > 1.5) callbacks?.onImpact?.(Math.min(1, impactV / 16), 'wall');
    } else if (body.pos.x < -maxX) {
      const impactV = Math.abs(body.vel.x);
      body.pos.x = -maxX;
      body.vel.x = impactV * RESTITUTION_WALL;
      body.angVel.y -= body.vel.x * 0.55;
      body.angVel.z -= body.vel.y * 0.22;
      if (impactV > 1.5) callbacks?.onImpact?.(Math.min(1, impactV / 16), 'wall');
    }

    if (body.pos.y > maxY) {
      const impactV = Math.abs(body.vel.y);
      body.pos.y = maxY;
      body.vel.y = -impactV * RESTITUTION_WALL;
      body.angVel.x += body.vel.y * 0.55;
      body.angVel.z -= body.vel.x * 0.22;
      if (impactV > 1.5) callbacks?.onImpact?.(Math.min(1, impactV / 16), 'wall');
    } else if (body.pos.y < -maxY) {
      const impactV = Math.abs(body.vel.y);
      body.pos.y = -maxY;
      body.vel.y = impactV * RESTITUTION_WALL;
      body.angVel.x += body.vel.y * 0.55;
      body.angVel.z += body.vel.x * 0.22;
      if (impactV > 1.5) callbacks?.onImpact?.(Math.min(1, impactV / 16), 'wall');
    }

    // Tabletop contact friction (less drag in air, realistic felt drag on floor)
    const onFloor = body.pos.z <= 0.02;
    const linearDrag = onFloor ? LINEAR_DRAG_FLOOR : LINEAR_DRAG_AIR;
    const linearFactor = Math.exp(-linearDrag * dt);
    body.vel.x *= linearFactor;
    body.vel.y *= linearFactor;

    // Realistic no-slip rolling torque when sliding across the tabletop floor
    const horizSpeedSq = body.vel.x * body.vel.x + body.vel.y * body.vel.y;
    if (onFloor && horizSpeedSq > 0.25 && (!body.isRolling || body.rollTimer < body.settleDuration * 0.65)) {
      const invR = 1 / Math.max(0.35, body.radius);
      const rollBlend = 1 - Math.exp(-6.5 * dt);
      body.angVel.x = THREE.MathUtils.lerp(body.angVel.x, -body.vel.y * invR, rollBlend);
      body.angVel.y = THREE.MathUtils.lerp(body.angVel.y, body.vel.x * invR, rollBlend);
    }

    const angularFactor = Math.exp(-ANGULAR_DRAG * dt);
    body.angVel.multiplyScalar(angularFactor);

    // Integrate angular velocity into quaternion
    const angSpeed = body.angVel.length();
    if (angSpeed > 0.001) {
      _axis.copy(body.angVel).divideScalar(angSpeed);
      _deltaQuat.setFromAxisAngle(_axis, angSpeed * dt);
      body.quat.premultiply(_deltaQuat).normalize();
    }

    // Smoothly align face to target quaternion as the roll finishes
    if (body.isRolling) {
      body.rollTimer += dt;
      const progress = body.rollTimer / Math.max(0.25, body.settleDuration);

      // Begin guiding orientation smoothly once past mid-roll and near the floor (or late in roll)
      if ((progress > 0.5 && body.pos.z < 0.75) || progress > 0.78) {
        const alignStrength = THREE.MathUtils.clamp((progress - 0.5) / 0.5, 0, 1);
        const slerpAlpha = 1 - Math.exp(-(6.5 + alignStrength * 15) * dt);
        body.quat.slerp(body.targetQuat, slerpAlpha);
        // Gently damp free spin as face locks in so it doesn't fight the slerp
        body.angVel.multiplyScalar(Math.exp(-5 * alignStrength * dt));
      }

      const angleToTarget = body.quat.angleTo(body.targetQuat);
      const naturalStop =
        progress >= 1 && body.pos.z <= 0.015 && horizSpeedSq < 0.09 && angleToTarget < 0.05;
      const safetyStop = progress >= 2.2 && body.pos.z <= 0.02;

      if (naturalStop || safetyStop) {
        body.quat.copy(body.targetQuat);
        body.vel.set(0, 0, 0);
        body.angVel.set(0, 0, 0);
        body.pos.z = 0;
        body.isRolling = false;
        body.settled = true;
        callbacks?.onDieSettled?.(body);
      }
    } else {
      // Gentle settle after casual drop or collision nudge
      const slerpAlpha = 1 - Math.exp(-8.5 * dt);
      body.quat.slerp(body.targetQuat, slerpAlpha);

      if (
        body.pos.z <= 0.015 &&
        horizSpeedSq < 0.04 &&
        angSpeed < 0.09 &&
        body.quat.angleTo(body.targetQuat) < 0.025
      ) {
        body.vel.set(0, 0, 0);
        body.angVel.set(0, 0, 0);
        body.quat.copy(body.targetQuat);
        body.pos.z = 0;
        body.settled = true;
      }
    }
  }

  // Pairwise elastic collisions with tangential spin transfer between dice
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];

      // Skip collisions when both are gliding cleanly to home positions
      if (a.gatherTarget && b.gatherTarget) continue;

      const minDist = (a.radius + b.radius) * 1.22;
      _diff.set(b.pos.x - a.pos.x, b.pos.y - a.pos.y, 0);
      const distSq = _diff.lengthSq();

      // Only collide if vertically close enough (allows high-arcing tossed dice to fly over resting ones!)
      const dz = Math.abs(b.pos.z - a.pos.z);
      if (dz > (a.radius + b.radius) * 1.1) continue;

      if (distSq < minDist * minDist && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        _normal.copy(_diff).divideScalar(dist);
        _tangent.set(-_normal.y, _normal.x, 0);

        if (a.isDragging && !b.isDragging) {
          b.gatherTarget = null;
          b.pos.addScaledVector(_normal, overlap);
          b.vel.addScaledVector(_normal, 6.2);
          b.angVel.z += (Math.random() - 0.5) * 6;
          b.settled = false;
          anyActive = true;
          callbacks?.onImpact?.(0.42, 'die');
        } else if (b.isDragging && !a.isDragging) {
          a.gatherTarget = null;
          a.pos.addScaledVector(_normal, -overlap);
          a.vel.addScaledVector(_normal, -6.2);
          a.angVel.z += (Math.random() - 0.5) * 6;
          a.settled = false;
          anyActive = true;
          callbacks?.onImpact?.(0.42, 'die');
        } else {
          a.pos.addScaledVector(_normal, -overlap * 0.5);
          b.pos.addScaledVector(_normal, overlap * 0.5);

          const relVx = b.vel.x - a.vel.x;
          const relVy = b.vel.y - a.vel.y;
          const velAlongNormal = relVx * _normal.x + relVy * _normal.y;

          if (velAlongNormal < 0) {
            const impulse = -(1 + RESTITUTION_DIE) * velAlongNormal * 0.5;
            a.vel.x -= impulse * _normal.x;
            a.vel.y -= impulse * _normal.y;
            b.vel.x += impulse * _normal.x;
            b.vel.y += impulse * _normal.y;

            // Tangential spin transfer on glancing hits
            const velAlongTangent = relVx * _tangent.x + relVy * _tangent.y;
            const spinKick = velAlongTangent * 0.55;
            a.angVel.z -= spinKick;
            b.angVel.z += spinKick;
            a.angVel.x += impulse * _normal.y * 0.6;
            a.angVel.y -= impulse * _normal.x * 0.6;
            b.angVel.x -= impulse * _normal.y * 0.6;
            b.angVel.y += impulse * _normal.x * 0.6;

            a.settled = false;
            b.settled = false;
            anyActive = true;

            const impactSpeed = Math.abs(velAlongNormal);
            if (impactSpeed > 1.2) {
              callbacks?.onImpact?.(Math.min(1, impactSpeed / 14), 'die');
            }
          }
        }
      }
    }
  }

  return anyActive;
}

/**
 * Advances all 3D dice bodies by dt seconds using 2 physics sub-steps (tunnel-free & tab-switch safe).
 * Returns true if any die is still active/moving (so the renderer knows whether to keep ticking).
 */
export function stepDicePhysics(
  bodies: Dice3DBody[],
  dt: number,
  bounds: Dice3DBounds,
  onDieSettledOrCallbacks?: ((body: Dice3DBody) => void) | DicePhysicsCallbacks
): boolean {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const subDt = clampedDt / PHYSICS_SUBSTEPS;
  const callbacks: DicePhysicsCallbacks | undefined =
    typeof onDieSettledOrCallbacks === 'function'
      ? { onDieSettled: onDieSettledOrCallbacks }
      : onDieSettledOrCallbacks;

  let anyActive = false;
  for (let s = 0; s < PHYSICS_SUBSTEPS; s++) {
    if (stepPhysicsSubstep(bodies, subDt, bounds, callbacks)) {
      anyActive = true;
    }
  }
  return anyActive;
}
