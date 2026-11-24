import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createBasePolyhedronGeometry,
  createPentagonalTrapezohedronGeometry,
  extractPolyhedronFaces,
  getQuaternionForFace,
  SUPPORTED_3D_SIDES,
} from './dice3DGeometry';
import {
  createDice3DBody,
  gatherDieBodyTo,
  launchDieBody,
  stepDicePhysics,
} from './dice3DPhysics';

describe('dice3DGeometry', () => {
  it('extracts the exact face count and distinct values 1..N for every polyhedral die', () => {
    for (const sides of SUPPORTED_3D_SIDES) {
      const geo = createBasePolyhedronGeometry(sides);
      const faces = extractPolyhedronFaces(geo, sides);
      expect(faces.length).toBe(sides);

      const values = faces.map((f) => f.value).sort((a, b) => a - b);
      const expected = Array.from({ length: sides }, (_, idx) => idx + 1);
      expect(values).toEqual(expected);

      for (const face of faces) {
        expect(face.normal.length()).toBeCloseTo(1, 4);
        expect(face.up.length()).toBeCloseTo(1, 4);
        expect(Math.abs(face.normal.dot(face.up))).toBeLessThan(1e-3);
        expect(face.inradius).toBeGreaterThan(0);
      }

      geo.dispose();
    }
  });

  it('constructs mathematically coplanar kite faces for the d10 Pentagonal Trapezohedron', () => {
    const geo = createPentagonalTrapezohedronGeometry(0.6);
    const pos = geo.attributes.position;
    expect(pos.count).toBe(60); // 10 kites * 2 triangles * 3 vertices

    // Each consecutive pair of triangles forms one kite; their unit normals must be identical
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const n1 = new THREE.Vector3();
    const n2 = new THREE.Vector3();

    for (let k = 0; k < 10; k++) {
      const base = k * 6;
      a.fromBufferAttribute(pos, base);
      b.fromBufferAttribute(pos, base + 1);
      c.fromBufferAttribute(pos, base + 2);
      n1.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();

      a.fromBufferAttribute(pos, base + 3);
      b.fromBufferAttribute(pos, base + 4);
      c.fromBufferAttribute(pos, base + 5);
      n2.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();

      expect(n1.dot(n2)).toBeGreaterThan(0.99999);
    }

    geo.dispose();
  });

  it('rotates every face normal to camera +Z with local up aligned to +Y', () => {
    const cameraZ = new THREE.Vector3(0, 0, 1);
    const screenY = new THREE.Vector3(0, 1, 0);

    for (const sides of SUPPORTED_3D_SIDES) {
      const geo = createBasePolyhedronGeometry(sides);
      const faces = extractPolyhedronFaces(geo, sides);

      for (const face of faces) {
        const q = getQuaternionForFace(face);
        const rotatedNormal = face.normal.clone().applyQuaternion(q);
        const rotatedUp = face.up.clone().applyQuaternion(q);

        expect(rotatedNormal.distanceTo(cameraZ)).toBeLessThan(1e-4);
        expect(rotatedUp.distanceTo(screenY)).toBeLessThan(1e-4);
      }

      geo.dispose();
    }
  });
});

describe('dice3DPhysics', () => {
  it('launches and settles a die cleanly onto its target face inside bounds with impact events', () => {
    const geo = createBasePolyhedronGeometry(20);
    const faces = extractPolyhedronFaces(geo, 20);
    const body = createDice3DBody({
      id: 'test-d20',
      dieId: 'd20',
      sides: 20,
      color: '#e879f9',
      isCompanion: true,
      radius: 0.56,
      faces,
      x: 0,
      y: 0,
      initialValue: 1,
    });

    const bounds = { halfW: 6, halfH: 4 };
    let settledCount = 0;
    const impacts: string[] = [];

    launchDieBody(body, 20, { vx: 14, vy: -9, vz: 10, duration: 0.65 });
    expect(body.isRolling).toBe(true);
    expect(body.targetValue).toBe(20);

    for (let i = 0; i < 180; i++) {
      stepDicePhysics([body], 1 / 60, bounds, {
        onDieSettled: () => {
          settledCount++;
        },
        onImpact: (_intensity, kind) => {
          impacts.push(kind);
        },
      });
    }

    expect(settledCount).toBe(1);
    expect(impacts).toContain('floor');
    expect(body.isRolling).toBe(false);
    expect(body.settled).toBe(true);
    expect(body.pos.z).toBe(0);
    expect(Math.abs(body.pos.x)).toBeLessThanOrEqual(bounds.halfW);
    expect(Math.abs(body.pos.y)).toBeLessThanOrEqual(bounds.halfH);
    expect(body.quat.angleTo(body.targetQuat)).toBeLessThan(1e-3);

    geo.dispose();
  });

  it('transfers momentum and spin on elastic die-to-die collisions', () => {
    const geo = createBasePolyhedronGeometry(6);
    const faces = extractPolyhedronFaces(geo, 6);
    const a = createDice3DBody({
      id: 'd6-a',
      dieId: 'd6',
      sides: 6,
      color: '#f59e0b',
      isCompanion: true,
      radius: 0.56,
      faces,
      x: -1.5,
      y: 0,
    });
    const b = createDice3DBody({
      id: 'd6-b',
      dieId: 'd6',
      sides: 6,
      color: '#f59e0b',
      isCompanion: false,
      radius: 0.56,
      faces,
      x: 0,
      y: 0.15,
    });

    a.vel.set(12, 0, 0);
    a.settled = false;

    const hitKinds: string[] = [];
    for (let i = 0; i < 30; i++) {
      stepDicePhysics([a, b], 1 / 60, { halfW: 6, halfH: 4 }, {
        onImpact: (_intensity, kind) => hitKinds.push(kind),
      });
    }

    expect(hitKinds).toContain('die');
    expect(b.vel.x).toBeGreaterThan(1);
    expect(b.pos.x).toBeGreaterThan(0.2);

    geo.dispose();
  });

  it('glides smoothly to the exact gatherTarget home coordinates', () => {
    const geo = createBasePolyhedronGeometry(12);
    const faces = extractPolyhedronFaces(geo, 12);
    const body = createDice3DBody({
      id: 'd12-home',
      dieId: 'd12',
      sides: 12,
      color: '#8b5cf6',
      isCompanion: true,
      radius: 0.56,
      faces,
      x: -4.2,
      y: 2.8,
      initialValue: 12,
    });

    gatherDieBodyTo(body, 3.5, -2.1);

    for (let i = 0; i < 160; i++) {
      stepDicePhysics([body], 1 / 60, { halfW: 6, halfH: 4 });
    }

    expect(body.gatherTarget).toBeNull();
    expect(body.settled).toBe(true);
    expect(body.pos.x).toBeCloseTo(3.5, 2);
    expect(body.pos.y).toBeCloseTo(-2.1, 2);
    expect(body.pos.z).toBe(0);

    geo.dispose();
  });
});
