import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { playDiceImpactSound, playDiceRollSound } from '../../lib/audio';
import {
  buildPolyhedralDieGroup,
  type BuiltDieModel,
  type PolyhedralDieSides,
} from '../../lib/dice3DGeometry';
import {
  createDice3DBody,
  gatherDieBodyTo,
  launchDieBody,
  stepDicePhysics,
  type Dice3DBody,
  type Dice3DBounds,
  type DicePhysicsCallbacks,
} from '../../lib/dice3DPhysics';
import { triggerHaptic } from '../../lib/haptics';
import { rollSingleDieRaw, STANDARD_DICE } from '../../lib/roll';
import { useAppStore } from '../../store/useAppStore';

interface CompanionSpec {
  dieId: string;
  sides: PolyhedralDieSides;
  color: string;
}

const COMPANION_SPECS: CompanionSpec[] = [4, 6, 8, 10, 12, 20].map((sides) => {
  const std = STANDARD_DICE.find((d) => d.sides === sides);
  return {
    dieId: std?.id || `d${sides}`,
    sides: sides as PolyhedralDieSides,
    color: std?.color || '#22d3ee',
  };
});

interface DieRuntimeEntry {
  body: Dice3DBody;
  model: BuiltDieModel;
  shadowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  hitMesh: THREE.Mesh;
  hoverAmount: number;
  isInteractiveRoll: boolean;
  fadeOutAt: number | null;
  scale: number;
}

interface FloatingBadgeState {
  id: number;
  dieId: string;
  sides: PolyhedralDieSides;
  value: number;
  color: string;
  x: number;
  y: number;
}

/**
 * Detects software WebGL rasterizers (SwiftShader / llvmpipe / Basic Render Driver).
 * Used strictly for rendering cost (antialias, pixelRatio, shadowMap, fenceSync).
 */
function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl =
      (probeCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probeCanvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render|subzero/i.test(rendererStr);
  } catch {
    return false;
  }
}

/**
 * Generates a soft radial alpha shadow texture so each die grounds naturally over the UI.
 */
function createContactShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(3, 5, 14, 0.72)');
  grad.addColorStop(0.55, 'rgba(3, 5, 14, 0.34)');
  grad.addColorStop(1, 'rgba(3, 5, 14, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Computes neat, non-overlapping home resting coordinates along the lower-right edge
 * so the 6 companion dice stay accessible without obstructing central content.
 */
function getHomePosition(
  index: number,
  bounds: Dice3DBounds,
  isCompact: boolean,
  dieRadius: number
): { x: number; y: number } {
  const stepX = dieRadius * 2.55;
  const stepY = dieRadius * 2.45;
  const cols = isCompact ? 6 : 3;
  const col = index % cols;
  const row = Math.floor(index / cols);

  if (isCompact) {
    // Neat bottom strip slightly above the mobile bottom navigation bar
    const totalW = (cols - 1) * stepX;
    const startX = -totalW * 0.5;
    const x = THREE.MathUtils.clamp(startX + col * stepX, -(bounds.halfW - 0.7), bounds.halfW - 0.7);
    const y = -bounds.halfH + dieRadius * 3.1;
    return { x, y };
  }

  // Desktop: tidy 3x2 cluster tucked into the bottom-right corner
  const rightMargin = bounds.halfW - dieRadius * 1.85;
  const bottomMargin = -bounds.halfH + dieRadius * 1.85;
  const x = rightMargin - (cols - 1 - col) * stepX;
  const y = bottomMargin + (1 - row) * stepY;
  return { x, y };
}

export const FloatingDice3DOverlay: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dice3DRollEvent = useAppStore((s) => s.dice3DRollEvent);
  const dice3DCommand = useAppStore((s) => s.dice3DCommand);

  const [badge, setBadge] = useState<FloatingBadgeState | null>(null);
  const badgeTimerRef = useRef<number | null>(null);

  // Imperative bridge so store events wake and drive the persistent WebGL world without recreating it
  const apiRef = useRef<{
    triggerRollEvent: (
      dice: { dieId: string; sides: PolyhedralDieSides; value: number; color: string }[]
    ) => void;
    runCommand: (type: 'toss-all' | 'gather') => void;
  } | null>(null);

  // Sync RollDeck roll events into the 3D scene
  useEffect(() => {
    if (!dice3DRollEvent || dice3DRollEvent.dice.length === 0) return;
    apiRef.current?.triggerRollEvent(dice3DRollEvent.dice);
  }, [dice3DRollEvent]);

  // Sync RollScreen commands ('toss-all' | 'gather')
  useEffect(() => {
    if (!dice3DCommand) return;
    apiRef.current?.runCommand(dice3DCommand.type);
  }, [dice3DCommand]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let disposed = false;

    const width = window.innerWidth;
    const height = window.innerHeight;
    let isCompact = width < 768;
    let dieRadius = isCompact ? 0.44 : 0.56;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      34,
      Math.max(1, width) / Math.max(1, height),
      0.1,
      100
    );
    camera.position.set(0, 0, 18);
    camera.lookAt(0, 0, 0);

    const computeBounds = (): Dice3DBounds => {
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
      const halfW = halfH * camera.aspect;
      return { halfW, halfH };
    };
    let bounds = computeBounds();

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    // Environment reflection map via RoomEnvironment + PMREMGenerator (always enabled)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Balanced 3-point warm/cool studio lighting rig
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.3);
    keyLight.position.set(6, 10, 14);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(512, 512);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e1b4b, 1.15);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x67e8f9, 1.2);
    rimLight.position.set(-8, -6, 9);
    scene.add(rimLight);

    // Shared contact shadow texture & max anisotropy
    const shadowTexture = createContactShadowTexture();
    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // Active dice entries & zero-GC reusable body array
    const entries: DieRuntimeEntry[] = [];
    const activeBodies: Dice3DBody[] = [];
    const hitMeshes: THREE.Mesh[] = [];

    const createEntry = (params: {
      id: string;
      dieId: string;
      sides: PolyhedralDieSides;
      color: string;
      isCompanion: boolean;
      x: number;
      y: number;
      initialValue?: number;
      radius: number;
    }): DieRuntimeEntry => {
      const model = buildPolyhedralDieGroup(params.sides, params.color, maxAnisotropy, params.radius);
      const body = createDice3DBody({
        id: params.id,
        dieId: params.dieId,
        sides: params.sides,
        color: params.color,
        isCompanion: params.isCompanion,
        radius: params.radius,
        faces: model.faces,
        x: params.x,
        y: params.y,
        initialValue: params.initialValue,
      });

      model.group.position.copy(body.pos);
      model.group.quaternion.copy(body.quat);
      scene.add(model.group);

      // Grounding contact shadow plane beneath die
      const shadowGeo = new THREE.PlaneGeometry(params.radius * 2.65, params.radius * 2.65);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.56,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.position.set(body.pos.x, body.pos.y, -0.58);
      shadowMesh.renderOrder = 0;
      scene.add(shadowMesh);

      const hitMesh =
        (model.group.getObjectByName('die-body') as THREE.Mesh | undefined) ||
        (model.group.children[0] as THREE.Mesh);
      hitMesh.userData.dieEntryId = params.id;

      const entry: DieRuntimeEntry = {
        body,
        model,
        shadowMesh,
        hitMesh,
        hoverAmount: 0,
        isInteractiveRoll: false,
        fadeOutAt: null,
        scale: 1,
      };
      entries.push(entry);
      activeBodies.push(body);
      hitMeshes.push(hitMesh);
      return entry;
    };

    const removeEntry = (entry: DieRuntimeEntry) => {
      scene.remove(entry.model.group);
      scene.remove(entry.shadowMesh);
      entry.model.dispose();
      entry.shadowMesh.geometry.dispose();
      entry.shadowMesh.material.dispose();

      const idx = entries.indexOf(entry);
      if (idx >= 0) entries.splice(idx, 1);
      const bodyIdx = activeBodies.indexOf(entry.body);
      if (bodyIdx >= 0) activeBodies.splice(bodyIdx, 1);
      const hitIdx = hitMeshes.indexOf(entry.hitMesh);
      if (hitIdx >= 0) hitMeshes.splice(hitIdx, 1);
    };

    const clearTemporaryDice = () => {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (!entries[i].body.isCompanion) {
          removeEntry(entries[i]);
        }
      }
    };

    // Spawn the 6 persistent companion dice (d4, d6, d8, d10, d12, d20)
    COMPANION_SPECS.forEach((spec, idx) => {
      const home = getHomePosition(idx, bounds, isCompact, dieRadius);
      createEntry({
        id: `companion-${spec.dieId}`,
        dieId: spec.dieId,
        sides: spec.sides,
        color: spec.color,
        isCompanion: true,
        x: home.x,
        y: home.y,
        initialValue: spec.sides,
        radius: dieRadius,
      });
    });

    // Pre-warm shaders once on hardware GPUs so the very first roll has zero shader-compile stutter
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Zero-GC scratch objects for raycasting, dragging, and projection
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const tabletopPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const planeHit = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    const dragPrevWorld = new THREE.Vector3();
    const dragVelocity = new THREE.Vector3();
    const projVec = new THREE.Vector3();
    const tiltAxis = new THREE.Vector3();
    const tiltQuat = new THREE.Quaternion();

    let hoveredEntry: DieRuntimeEntry | null = null;
    let draggedEntry: DieRuntimeEntry | null = null;
    let activePointerId: number | null = null;
    let pointerDownClientX = 0;
    let pointerDownClientY = 0;
    let pointerDownTime = 0;
    let dragLastTime = 0;
    let lastHoverCheckTime = 0;
    let pointerTravel = 0;

    // Sleep-aware animation loop with canonical software-WebGL fenceSync + 80ms pacing
    let rafId = 0;
    let timerId = 0;
    let isLoopRunning = false;
    let lastFrameTime = performance.now();

    const glCtx = renderer.getContext();
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' && glCtx instanceof WebGL2RenderingContext;

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      if (!isWebGL2) {
        timerId = window.setTimeout(cb, 80);
        return;
      }
      const gl2 = glCtx as WebGL2RenderingContext;
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl2.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl2.deleteSync(sync);
          return;
        }
        const status = sync ? gl2.getSyncParameter(sync, gl2.SYNC_STATUS) : gl2.SIGNALED;
        if (status === gl2.UNSIGNALED) {
          timerId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl2.deleteSync(sync);
          timerId = window.setTimeout(cb, 80);
        }
      };
      timerId = window.setTimeout(poll, 5);
    };

    const showBadgeForBody = (body: Dice3DBody) => {
      projVec.set(body.pos.x, body.pos.y + body.radius * 1.48, body.pos.z);
      projVec.project(camera);
      const sx = (projVec.x + 1) * 0.5 * window.innerWidth;
      const sy = (1 - projVec.y) * 0.5 * window.innerHeight;

      const clampedX = Math.max(64, Math.min(window.innerWidth - 64, sx));
      const clampedY = Math.max(48, Math.min(window.innerHeight - 96, sy));

      setBadge({
        id: Date.now() + Math.random(),
        dieId: body.dieId,
        sides: body.sides,
        value: body.targetValue,
        color: body.color,
        x: clampedX,
        y: clampedY,
      });

      if (badgeTimerRef.current) {
        window.clearTimeout(badgeTimerRef.current);
      }
      badgeTimerRef.current = window.setTimeout(() => {
        setBadge(null);
      }, 2400);
    };

    const physicsCallbacks: DicePhysicsCallbacks = {
      onDieSettled: (settledBody) => {
        const entry = entries.find((e) => e.body === settledBody);
        if (entry && entry.isInteractiveRoll) {
          entry.isInteractiveRoll = false;
          showBadgeForBody(settledBody);
          useAppStore
            .getState()
            .recordInteractive3DRoll(
              settledBody.dieId,
              settledBody.sides,
              settledBody.targetValue,
              settledBody.color
            );
        }
      },
      onImpact: (intensity, kind) => {
        if (useAppStore.getState().settings.soundEnabled) {
          playDiceImpactSound(intensity, kind);
        }
      },
    };

    const renderOnce = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };

    const tick = () => {
      if (disposed) {
        isLoopRunning = false;
        return;
      }

      const now = performance.now();
      const dt = Math.min(Math.max((now - lastFrameTime) / 1000, 0.001), 0.05);
      lastFrameTime = now;

      const physicsActive = stepDicePhysics(activeBodies, dt, bounds, physicsCallbacks);

      let visualsActive = false;

      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const targetHover = entry.body.isHovered || entry.body.isDragging ? 1 : 0;
        const nextHover = THREE.MathUtils.damp(entry.hoverAmount, targetHover, 12, dt);
        if (Math.abs(nextHover - entry.hoverAmount) > 0.004) {
          visualsActive = true;
        }
        entry.hoverAmount = nextHover;

        // Handle temporary extra dice fade-out after their roll settles
        if (entry.fadeOutAt !== null) {
          if (now >= entry.fadeOutAt) {
            entry.scale = THREE.MathUtils.damp(entry.scale, 0, 9, dt);
            visualsActive = true;
            if (entry.scale < 0.04) {
              removeEntry(entry);
              continue;
            }
          } else {
            visualsActive = true;
          }
        }

        const liftBoost = entry.hoverAmount * 0.16;
        const hoverScale = entry.scale * (1 + entry.hoverAmount * 0.09);

        entry.model.group.position.set(
          entry.body.pos.x,
          entry.body.pos.y,
          entry.body.pos.z + liftBoost
        );
        entry.model.group.quaternion.copy(entry.body.quat);
        entry.model.group.scale.setScalar(hoverScale);

        // Subtle emissive & metallic edge highlight on hover/drag
        entry.model.bodyMaterial.emissiveIntensity = 0.58 + entry.hoverAmount * 0.55;
        entry.model.bevelMaterial.emissiveIntensity = 0.35 + entry.hoverAmount * 0.65;
        entry.model.edgeMaterial.opacity = 0.42 + entry.hoverAmount * 0.52;

        // Grounding contact shadow updates dynamically with die lift height
        const heightAboveFloor = Math.max(0, entry.body.pos.z + liftBoost);
        const shadowScale = entry.scale * (1 + heightAboveFloor * 0.24);
        entry.shadowMesh.position.set(
          entry.body.pos.x + heightAboveFloor * 0.12,
          entry.body.pos.y - heightAboveFloor * 0.14,
          -0.58
        );
        entry.shadowMesh.scale.setScalar(shadowScale);
        entry.shadowMesh.material.opacity =
          THREE.MathUtils.clamp(0.56 - heightAboveFloor * 0.16, 0.12, 0.56) * entry.scale;
      }

      renderer.render(scene, camera);

      if (physicsActive || visualsActive) {
        afterDraw(tick);
      } else {
        isLoopRunning = false;
      }
    };

    const wake = () => {
      if (disposed) return;
      if (!isLoopRunning) {
        isLoopRunning = true;
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    // Imperative API exposed to React effects for store roll events & commands
    apiRef.current = {
      triggerRollEvent: (rolledDice) => {
        clearTemporaryDice();
        const usedIds = new Set<string>();
        const count = rolledDice.length;
        // Shift center bias slightly right on desktop to favor open content area over left sidebar
        const desktopCenterBiasX = isCompact ? 0 : Math.min(bounds.halfW * 0.12, 0.85);

        rolledDice.forEach((item, idx) => {
          let entry = entries.find(
            (e) => e.body.isCompanion && e.body.sides === item.sides && !usedIds.has(e.body.id)
          );

          if (!entry) {
            const angle = (idx / Math.max(1, count)) * Math.PI * 2;
            const spawnX = desktopCenterBiasX + Math.cos(angle) * Math.min(bounds.halfW * 0.42, 3.0);
            const spawnY = Math.sin(angle) * Math.min(bounds.halfH * 0.38, 2.2);
            entry = createEntry({
              id: `temp-${item.dieId}-${idx}-${Date.now()}`,
              dieId: item.dieId,
              sides: item.sides,
              color: item.color,
              isCompanion: false,
              x: spawnX,
              y: spawnY,
              initialValue: item.value,
              radius: dieRadius,
            });
            entry.fadeOutAt = performance.now() + 5200;
          }

          usedIds.add(entry.body.id);
          entry.isInteractiveRoll = false;

          const targetX =
            desktopCenterBiasX +
            ((idx - (count - 1) * 0.5) / Math.max(1, count)) * Math.min(bounds.halfW * 1.05, 5.8);
          const targetY = (Math.random() - 0.5) * Math.min(bounds.halfH * 0.68, 3.2);
          const vx = THREE.MathUtils.clamp(
            (targetX - entry.body.pos.x) * 2.5 + (Math.random() - 0.5) * 6,
            -15,
            15
          );
          const vy = THREE.MathUtils.clamp(
            (targetY - entry.body.pos.y) * 2.5 + (Math.random() - 0.5) * 6,
            -13,
            13
          );

          launchDieBody(entry.body, item.value, {
            vx,
            vy,
            vz: 9.5 + Math.random() * 4.5,
            duration: 0.78,
          });
        });

        wake();
      },

      runCommand: (type) => {
        if (type === 'gather') {
          clearTemporaryDice();
          const companions = entries.filter((e) => e.body.isCompanion);
          companions.forEach((entry, idx) => {
            const home = getHomePosition(idx, bounds, isCompact, dieRadius);
            entry.isInteractiveRoll = false;
            gatherDieBodyTo(entry.body, home.x, home.y);
          });
          wake();
        } else if (type === 'toss-all') {
          clearTemporaryDice();
          const settings = useAppStore.getState().settings;
          if (settings.soundEnabled) playDiceRollSound(6);
          triggerHaptic('roll', settings.hapticsEnabled);

          const desktopCenterBiasX = isCompact ? 0 : Math.min(bounds.halfW * 0.12, 0.85);
          const companions = entries.filter((e) => e.body.isCompanion);
          companions.forEach((entry, idx) => {
            const freshVal = rollSingleDieRaw(entry.body.sides);
            entry.isInteractiveRoll = false;
            const spreadX =
              desktopCenterBiasX + ((idx - 2.5) / 3) * Math.min(bounds.halfW * 0.82, 5.0);
            const spreadY = (Math.random() - 0.5) * Math.min(bounds.halfH * 0.68, 3.0);
            const vx = THREE.MathUtils.clamp(
              (spreadX - entry.body.pos.x) * 2.6 + (Math.random() - 0.5) * 7,
              -16,
              16
            );
            const vy = THREE.MathUtils.clamp(
              (spreadY - entry.body.pos.y) * 2.6 + (Math.random() - 0.5) * 7,
              -14,
              14
            );
            launchDieBody(entry.body, freshVal, {
              vx,
              vy,
              vz: 10 + Math.random() * 4.5,
              duration: 0.82,
            });
          });
          wake();
        }
      },
    };

    // Raycast helper from client screen coordinates
    const setPointerRay = (clientX: number, clientY: number) => {
      pointerNdc.x = (clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pointerNdc.y = -(clientY / Math.max(1, window.innerHeight)) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
    };

    const pickDieAt = (clientX: number, clientY: number): DieRuntimeEntry | null => {
      setPointerRay(clientX, clientY);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length === 0) return null;
      const entryId = hits[0].object.userData.dieEntryId as string | undefined;
      if (!entryId) return null;
      return entries.find((e) => e.body.id === entryId) || null;
    };

    const isBlockedByModal = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('[role="dialog"], [data-dice3d-ignore="true"]'));
    };

    const setHoverEntry = (next: DieRuntimeEntry | null) => {
      if (hoveredEntry === next) return;
      if (hoveredEntry) hoveredEntry.body.isHovered = false;
      hoveredEntry = next;
      if (hoveredEntry) hoveredEntry.body.isHovered = true;
      if (!draggedEntry) {
        document.body.style.cursor = hoveredEntry ? 'grab' : '';
      }
      wake();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (isBlockedByModal(e.target)) return;

      const hit = pickDieAt(e.clientX, e.clientY);
      if (!hit) return;

      // Intercept only when user directly grabs a 3D die; let everything else pass through
      e.preventDefault();
      e.stopPropagation();

      setBadge(null);

      draggedEntry = hit;
      activePointerId = e.pointerId;
      pointerDownClientX = e.clientX;
      pointerDownClientY = e.clientY;
      pointerDownTime = performance.now();
      dragLastTime = pointerDownTime;
      pointerTravel = 0;
      dragVelocity.set(0, 0, 0);

      hit.body.isDragging = true;
      hit.body.isRolling = false;
      hit.body.gatherTarget = null;
      hit.body.vel.set(0, 0, 0);
      hit.body.angVel.set(0, 0, 0);
      hit.isInteractiveRoll = false;
      if (hit.fadeOutAt !== null) {
        hit.fadeOutAt = performance.now() + 8000;
      }

      if (raycaster.ray.intersectPlane(tabletopPlane, planeHit)) {
        dragOffset.set(hit.body.pos.x - planeHit.x, hit.body.pos.y - planeHit.y, 0);
        dragPrevWorld.copy(hit.body.pos);
      }

      setHoverEntry(hit);
      document.body.style.cursor = 'grabbing';
      wake();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (draggedEntry && e.pointerId === activePointerId) {
        const dxScreen = e.clientX - pointerDownClientX;
        const dyScreen = e.clientY - pointerDownClientY;
        pointerTravel = Math.max(pointerTravel, Math.hypot(dxScreen, dyScreen));

        setPointerRay(e.clientX, e.clientY);
        if (raycaster.ray.intersectPlane(tabletopPlane, planeHit)) {
          const maxX = Math.max(0.8, bounds.halfW - draggedEntry.body.radius * 1.15);
          const maxY = Math.max(0.8, bounds.halfH - draggedEntry.body.radius * 1.15);

          const nextX = THREE.MathUtils.clamp(planeHit.x + dragOffset.x, -maxX, maxX);
          const nextY = THREE.MathUtils.clamp(planeHit.y + dragOffset.y, -maxY, maxY);

          const now = performance.now();
          const dt = Math.max(0.004, (now - dragLastTime) / 1000);
          dragLastTime = now;

          const instVx = (nextX - dragPrevWorld.x) / dt;
          const instVy = (nextY - dragPrevWorld.y) / dt;
          dragVelocity.x = THREE.MathUtils.lerp(dragVelocity.x, instVx, 0.35);
          dragVelocity.y = THREE.MathUtils.lerp(dragVelocity.y, instVy, 0.35);

          draggedEntry.body.pos.x = nextX;
          draggedEntry.body.pos.y = nextY;
          dragPrevWorld.set(nextX, nextY, draggedEntry.body.pos.z);

          // Physical inertial tilt while carrying the die with the cursor
          const moveSpeed = Math.hypot(instVx, instVy);
          if (moveSpeed > 0.6) {
            tiltAxis.set(-instVy, instVx, 0).normalize();
            tiltQuat.setFromAxisAngle(tiltAxis, Math.min(moveSpeed * dt * 0.52, 0.35));
            draggedEntry.body.quat.premultiply(tiltQuat).normalize();
          }
        }
        wake();
        return;
      }

      // Throttled hover detection (~24ms) so pointermove across other tabs has negligible overhead
      if (e.pointerType === 'mouse') {
        const now = performance.now();
        if (now - lastHoverCheckTime < 24) return;
        lastHoverCheckTime = now;

        if (isBlockedByModal(e.target)) {
          setHoverEntry(null);
          return;
        }
        const hit = pickDieAt(e.clientX, e.clientY);
        setHoverEntry(hit);
      }
    };

    const releaseDrag = (e: PointerEvent) => {
      if (!draggedEntry || e.pointerId !== activePointerId) return;

      const entry = draggedEntry;
      draggedEntry = null;
      activePointerId = null;
      entry.body.isDragging = false;
      document.body.style.cursor = hoveredEntry ? 'grab' : '';

      const elapsed = performance.now() - pointerDownTime;
      const flickSpeed = Math.hypot(dragVelocity.x, dragVelocity.y);
      const settings = useAppStore.getState().settings;

      const isQuickClick = pointerTravel < 9 && elapsed < 290;
      const isFlickToss = flickSpeed > 2.8;

      if (isQuickClick || isFlickToss) {
        const freshValue = rollSingleDieRaw(entry.body.sides);
        entry.isInteractiveRoll = true;
        if (settings.soundEnabled) playDiceRollSound(1);
        triggerHaptic('roll', settings.hapticsEnabled);

        if (isQuickClick) {
          launchDieBody(entry.body, freshValue, {
            vx: (Math.random() - 0.5) * 4.5,
            vy: (Math.random() - 0.5) * 4.5,
            vz: 11.4,
            duration: 0.68,
          });
        } else {
          launchDieBody(entry.body, freshValue, {
            vx: THREE.MathUtils.clamp(dragVelocity.x * 0.88, -22, 22),
            vy: THREE.MathUtils.clamp(dragVelocity.y * 0.88, -20, 20),
            vz: THREE.MathUtils.clamp(7.5 + flickSpeed * 0.36, 8, 15.5),
            duration: 0.78,
          });
        }
      } else {
        // Gentle drop to reposition the die cleanly without triggering a new roll
        entry.body.vel.set(dragVelocity.x * 0.2, dragVelocity.y * 0.2, 0);
        entry.body.settled = false;
      }

      wake();
    };

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      isCompact = w < 768;
      dieRadius = isCompact ? 0.44 : 0.56;
      camera.aspect = Math.max(1, w) / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      bounds = computeBounds();

      const maxX = Math.max(0.8, bounds.halfW - dieRadius * 1.15);
      const maxY = Math.max(0.8, bounds.halfH - dieRadius * 1.15);
      for (const entry of entries) {
        entry.body.pos.x = THREE.MathUtils.clamp(entry.body.pos.x, -maxX, maxX);
        entry.body.pos.y = THREE.MathUtils.clamp(entry.body.pos.y, -maxY, maxY);
        entry.model.group.position.set(entry.body.pos.x, entry.body.pos.y, entry.body.pos.z);
        entry.shadowMesh.position.set(entry.body.pos.x, entry.body.pos.y, -0.58);
      }
      renderOnce();
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', releaseDrag);
    window.addEventListener('pointercancel', releaseDrag);
    window.addEventListener('resize', onResize);

    // Initial crisp render of the resting 6 companion dice
    renderOnce();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      apiRef.current = null;
      document.body.style.cursor = '';

      if (badgeTimerRef.current) {
        window.clearTimeout(badgeTimerRef.current);
      }

      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', releaseDrag);
      window.removeEventListener('pointercancel', releaseDrag);
      window.removeEventListener('resize', onResize);

      for (let i = entries.length - 1; i >= 0; i--) {
        removeEntry(entries[i]);
      }
      shadowTexture?.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  const isCritMax = badge && badge.value === badge.sides;
  const isCritOne = badge && badge.value === 1 && badge.sides > 2;

  return (
    <div
      className="fixed inset-0 z-[35] pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Dedicated empty mount node for the Three.js WebGL canvas */}
      <div ref={mountRef} className="w-full h-full pointer-events-none" />

      {/* Crisp non-blur result badge positioned above a manually rolled 3D die */}
      {badge && (
        <div
          key={badge.id}
          className="fixed -translate-x-1/2 -translate-y-full pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{ left: `${badge.x}px`, top: `${badge.y}px` }}
        >
          <div
            className={`px-3 py-1 rounded-xl border shadow-2xl flex items-center gap-2 font-mono text-xs font-extrabold ${
              isCritMax
                ? 'bg-slate-950/95 border-amber-400 text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.45)]'
                : isCritOne
                ? 'bg-slate-950/95 border-rose-500 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.4)]'
                : 'bg-slate-950/95 border-white/20 text-white'
            }`}
            style={{
              borderColor: !isCritMax && !isCritOne ? `${badge.color}99` : undefined,
            }}
          >
            <span className="uppercase tracking-wider text-[10px] opacity-80" style={{ color: badge.color }}>
              {badge.dieId}
            </span>
            <span className="text-base leading-none">{badge.value}</span>
            {isCritMax && badge.sides === 20 && (
              <span className="text-[9px] uppercase tracking-widest text-amber-200">CRÍTICO!</span>
            )}
            {isCritOne && badge.sides === 20 && (
              <span className="text-[9px] uppercase tracking-widest text-rose-300">FALHA!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
