import * as THREE from 'three';

export type PolyhedralDieSides = 4 | 6 | 8 | 10 | 12 | 20;

export const SUPPORTED_3D_SIDES: PolyhedralDieSides[] = [4, 6, 8, 10, 12, 20];

export interface DieFaceInfo {
  value: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  up: THREE.Vector3;
  inradius: number;
}

export interface BuiltDieModel {
  group: THREE.Group;
  faces: DieFaceInfo[];
  radius: number;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  bevelMaterial: THREE.MeshStandardMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
  dispose: () => void;
}

export function isSupported3DSides(sides: number): sides is PolyhedralDieSides {
  return sides === 4 || sides === 6 || sides === 8 || sides === 10 || sides === 12 || sides === 20;
}

/**
 * Constructs a mathematically exact Pentagonal Trapezohedron (standard tabletop d10)
 * as a non-indexed BufferGeometry composed of 10 perfectly coplanar kite faces (20 triangles).
 *
 * Exact coplanarity identity: ringZ / H = (1 - cos(π/5)) / (1 + cos(π/5)) = tan²(π/10).
 */
export function createPentagonalTrapezohedronGeometry(radius = 0.62): THREE.BufferGeometry {
  const H = 1.0 * radius;
  const ringR = 0.92 * radius;
  const tanPiOver10 = Math.tan(Math.PI / 10);
  const ringZ = H * tanPiOver10 * tanPiOver10; // ≈ 0.105572809 * H (mathematically exact flat kites)

  const topPole = new THREE.Vector3(0, H, 0);
  const bottomPole = new THREE.Vector3(0, -H, 0);

  const upperRing: THREE.Vector3[] = [];
  const lowerRing: THREE.Vector3[] = [];

  for (let i = 0; i < 5; i++) {
    const aUpper = (i * 2 * Math.PI) / 5;
    const aLower = aUpper + Math.PI / 5;
    upperRing.push(new THREE.Vector3(Math.cos(aUpper) * ringR, ringZ, Math.sin(aUpper) * ringR));
    lowerRing.push(new THREE.Vector3(Math.cos(aLower) * ringR, -ringZ, Math.sin(aLower) * ringR));
  }

  const positions: number[] = [];

  const pushTriOutward = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    const n = new THREE.Vector3().crossVectors(ab, ac);
    const centroid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
    if (n.dot(centroid) >= 0) {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    } else {
      positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  };

  for (let i = 0; i < 5; i++) {
    const u0 = upperRing[i];
    const u1 = upperRing[(i + 1) % 5];
    const l0 = lowerRing[i];
    const lPrev = lowerRing[(i + 4) % 5];

    // Upper flat kite: topPole -> u0 -> l0 -> u1
    pushTriOutward(topPole, u1, l0);
    pushTriOutward(topPole, l0, u0);

    // Lower flat kite: bottomPole -> lPrev -> u0 -> l0
    pushTriOutward(bottomPole, lPrev, u0);
    pushTriOutward(bottomPole, u0, l0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Returns the base solid geometry for each polyhedral RPG die, calibrated
 * so all 6 dice feel visually balanced in size on screen.
 */
export function createBasePolyhedronGeometry(
  sides: PolyhedralDieSides,
  radius = 0.58
): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry;
  switch (sides) {
    case 4:
      geo = new THREE.TetrahedronGeometry(radius * 1.1, 0);
      break;
    case 6:
      geo = new THREE.BoxGeometry(radius * 1.32, radius * 1.32, radius * 1.32);
      break;
    case 8:
      geo = new THREE.OctahedronGeometry(radius * 1.08, 0);
      break;
    case 10:
      geo = createPentagonalTrapezohedronGeometry(radius * 1.08);
      break;
    case 12:
      geo = new THREE.DodecahedronGeometry(radius * 1.02, 0);
      break;
    case 20:
      geo = new THREE.IcosahedronGeometry(radius * 1.04, 0);
      break;
  }
  return geo.index ? geo.toNonIndexed() : geo;
}

/**
 * Builds a single merged 3D metallic edge-strut BufferGeometry along every sharp edge
 * of a polyhedron so specular highlights catch real 3D bevels (not just 1px WebGL lines).
 */
function createMetallicBevelFrameGeometry(
  edgesGeo: THREE.EdgesGeometry,
  strutRadius: number
): THREE.BufferGeometry {
  const posAttr = edgesGeo.attributes.position;
  const segmentCount = Math.floor(posAttr.count / 2);

  const radialSegments = 5;
  const positions: number[] = [];
  const normals: number[] = [];

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const upRef = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const v00 = new THREE.Vector3();
  const v01 = new THREE.Vector3();
  const v10 = new THREE.Vector3();
  const v11 = new THREE.Vector3();

  for (let s = 0; s < segmentCount; s++) {
    pA.fromBufferAttribute(posAttr, s * 2);
    pB.fromBufferAttribute(posAttr, s * 2 + 1);
    dir.subVectors(pB, pA);
    const len = dir.length();
    if (len < 1e-5) continue;
    dir.divideScalar(len);

    // Slight endpoint extension so bevel corners join cleanly at vertices
    pA.addScaledVector(dir, -strutRadius * 0.65);
    pB.addScaledVector(dir, strutRadius * 0.65);

    upRef.set(0, 1, 0);
    if (Math.abs(dir.dot(upRef)) > 0.92) {
      upRef.set(1, 0, 0);
    }
    u.crossVectors(dir, upRef).normalize();
    v.crossVectors(dir, u).normalize();

    for (let r = 0; r < radialSegments; r++) {
      const a0 = (r / radialSegments) * Math.PI * 2;
      const a1 = ((r + 1) / radialSegments) * Math.PI * 2;

      n0.copy(u).multiplyScalar(Math.cos(a0)).addScaledVector(v, Math.sin(a0));
      n1.copy(u).multiplyScalar(Math.cos(a1)).addScaledVector(v, Math.sin(a1));

      v00.copy(pA).addScaledVector(n0, strutRadius);
      v01.copy(pA).addScaledVector(n1, strutRadius);
      v10.copy(pB).addScaledVector(n0, strutRadius);
      v11.copy(pB).addScaledVector(n1, strutRadius);

      // Tri 1: v00 -> v10 -> v11
      positions.push(v00.x, v00.y, v00.z, v10.x, v10.y, v10.z, v11.x, v11.y, v11.z);
      normals.push(n0.x, n0.y, n0.z, n0.x, n0.y, n0.z, n1.x, n1.y, n1.z);

      // Tri 2: v00 -> v11 -> v01
      positions.push(v00.x, v00.y, v00.z, v11.x, v11.y, v11.z, v01.x, v01.y, v01.z);
      normals.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n1.x, n1.y, n1.z);
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}

interface RawFaceCluster {
  normal: THREE.Vector3;
  vertices: THREE.Vector3[];
}

/**
 * Groups coplanar triangles of a convex polyhedron into distinct geometric faces
 * and calculates each face's exact centroid, outward unit normal, local tangent 'up', and inradius.
 */
export function extractPolyhedronFaces(
  geometry: THREE.BufferGeometry,
  sides: PolyhedralDieSides
): DieFaceInfo[] {
  const posAttr = geometry.attributes.position;
  const clusters: RawFaceCluster[] = [];

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const triNormal = new THREE.Vector3();
  const triCenter = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i += 3) {
    a.fromBufferAttribute(posAttr, i);
    b.fromBufferAttribute(posAttr, i + 1);
    c.fromBufferAttribute(posAttr, i + 2);

    ab.subVectors(b, a);
    ac.subVectors(c, a);
    triNormal.crossVectors(ab, ac).normalize();

    triCenter.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (triNormal.dot(triCenter) < 0) {
      triNormal.negate();
    }

    let matched: RawFaceCluster | undefined;
    for (const cluster of clusters) {
      if (cluster.normal.dot(triNormal) > 0.996) {
        matched = cluster;
        break;
      }
    }

    if (!matched) {
      clusters.push({
        normal: triNormal.clone(),
        vertices: [a.clone(), b.clone(), c.clone()],
      });
    } else {
      matched.vertices.push(a.clone(), b.clone(), c.clone());
    }
  }

  // Deduplicate vertices inside each face cluster and compute centroid + inradius
  const rawFaces = clusters.map((cluster) => {
    const uniqueVerts: THREE.Vector3[] = [];
    for (const v of cluster.vertices) {
      if (!uniqueVerts.some((u) => u.distanceToSquared(v) < 1e-5)) {
        uniqueVerts.push(v);
      }
    }

    const center = new THREE.Vector3();
    for (const v of uniqueVerts) center.add(v);
    center.divideScalar(Math.max(1, uniqueVerts.length));

    // Average distance from centroid to vertices -> reliable scale for face decal
    let avgDist = 0;
    for (const v of uniqueVerts) {
      avgDist += v.distanceTo(center);
    }
    avgDist /= Math.max(1, uniqueVerts.length);

    // Choose a deterministic tangent 'up' pointing toward the first vertex (or polar apex for d10)
    const up = new THREE.Vector3();
    if (sides === 10) {
      // Align d10 numbers cleanly toward the closest pole (top or bottom apex)
      const pole = cluster.normal.y >= 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
      up.copy(pole).addScaledVector(cluster.normal, -pole.dot(cluster.normal)).normalize();
    } else {
      const refVertex = uniqueVerts[0] || new THREE.Vector3(0, 1, 0);
      up.subVectors(refVertex, center);
      up.addScaledVector(cluster.normal, -up.dot(cluster.normal));
      if (up.lengthSq() < 1e-5) {
        const fallback =
          Math.abs(cluster.normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        up.crossVectors(cluster.normal, fallback);
      }
      up.normalize();
    }

    return {
      normal: cluster.normal.clone().normalize(),
      center,
      up,
      inradius: avgDist,
    };
  });

  // Sort faces deterministically (top-to-bottom, then azimuth) before assigning numbers
  rawFaces.sort((f1, f2) => {
    const dy = f2.normal.y - f1.normal.y;
    if (Math.abs(dy) > 0.05) return dy;
    const a1 = Math.atan2(f1.normal.z, f1.normal.x);
    const a2 = Math.atan2(f2.normal.z, f2.normal.x);
    return a1 - a2;
  });

  // Assign standard tabletop numbering (for d6 opposite faces sum to 7; for others 1..sides)
  const values = assignFaceValues(rawFaces.length, sides);

  return rawFaces.slice(0, sides).map((f, idx) => ({
    value: values[idx] ?? idx + 1,
    normal: f.normal,
    center: f.center,
    up: f.up,
    inradius: f.inradius,
  }));
}

function assignFaceValues(faceCount: number, sides: PolyhedralDieSides): number[] {
  if (sides === 6 && faceCount >= 6) {
    // Sorted order on BoxGeometry: +Y (top), 4 equator faces, -Y (bottom)
    return [6, 2, 3, 5, 4, 1];
  }
  const vals: number[] = [];
  for (let i = 1; i <= sides; i++) vals.push(i);
  return vals;
}

/**
 * Computes the exact quaternion that rotates the die so the chosen face points
 * straight toward the camera (+Z) with its local 'up' aligned to screen +Y.
 */
export function getQuaternionForFace(face: DieFaceInfo): THREE.Quaternion {
  const zAxis = face.normal.clone().normalize();
  const yAxis = face.up.clone().normalize();
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  yAxis.crossVectors(zAxis, xAxis).normalize();

  const basisMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const invMatrix = basisMatrix.clone().invert();
  return new THREE.Quaternion().setFromRotationMatrix(invMatrix);
}

/**
 * Generates a subtle procedural linear-space roughness map (subtle swirled resin grain)
 * shared across all dice bodies for tactile PBR light response.
 */
let cachedResinRoughnessTex: THREE.CanvasTexture | null = null;

function getSharedResinRoughnessTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedResinRoughnessTex) return cachedResinRoughnessTex;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base smooth resin roughness (~0.36) with subtle micro-swirl grain
  ctx.fillStyle = '#5c5c5c';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 420; i++) {
    const x = (i * 53) % size;
    const y = (i * 97) % size;
    const r = 1 + (i % 5);
    const tone = 72 + ((i * 29) % 48);
    ctx.fillStyle = `rgba(${tone},${tone},${tone},0.22)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // Data map stays linear
  tex.needsUpdate = true;
  cachedResinRoughnessTex = tex;
  return tex;
}

/**
 * Generates a crisp procedural CanvasTexture for a single die face number.
 * Uses SRGBColorSpace and supports underline notation for 6 and 9, plus golden crest on max faces.
 */
function createFaceNumberTexture(
  value: number,
  sides: PolyhedralDieSides,
  accentHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);

  const label = String(value);
  const needsUnderline = sides >= 8 && (value === 6 || value === 9);
  const isMaxFace = value === sides;

  // Ornamental engraved crest on max face (e.g. 20 on d20, 12 on d12, 6 on d6)
  if (isMaxFace) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.37, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.72)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Subtle 4-point diamond ticks around max face ring
    ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2;
      const tx = size / 2 + Math.cos(ang) * (size * 0.37);
      const ty = size / 2 + Math.sin(ang) * (size * 0.37);
      ctx.beginPath();
      ctx.arc(tx, ty, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Sharp engraved metallic/ivory typography with deep bevel contour for maximum legibility
  const fontSize = label.length >= 2 ? 122 : 146;
  ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Carved recess shadow
  ctx.lineWidth = 20;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(3, 5, 14, 0.92)';
  ctx.strokeText(label, size / 2, size / 2 + 5);

  // Subtle colored inner glow
  ctx.shadowColor = isMaxFace ? '#fbbf24' : accentHex;
  ctx.shadowBlur = 10;

  // Main bright number fill (golden tint on max value, crisp ivory pearl on others)
  ctx.fillStyle = isMaxFace ? '#fef08a' : '#f8fafc';
  ctx.fillText(label, size / 2, size / 2 + 2);
  ctx.shadowBlur = 0;

  if (needsUnderline) {
    ctx.fillStyle = isMaxFace ? '#fef08a' : '#f8fafc';
    ctx.strokeStyle = 'rgba(3, 5, 14, 0.9)';
    ctx.lineWidth = 6;
    const barW = 54;
    const barH = 10;
    const bx = size / 2 - barW / 2;
    const by = size / 2 + fontSize * 0.44;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillRect(bx, by, barW, barH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.max(1, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

// Module-level cache of face textures by (sides-value-color) to save GPU memory
const faceTextureCache = new Map<string, THREE.CanvasTexture>();

function getCachedFaceTexture(
  value: number,
  sides: PolyhedralDieSides,
  color: string,
  maxAnisotropy: number
): THREE.CanvasTexture | null {
  const key = `${sides}:${value}:${color}`;
  const existing = faceTextureCache.get(key);
  if (existing) return existing;
  const created = createFaceNumberTexture(value, sides, color, maxAnisotropy);
  if (created) {
    faceTextureCache.set(key, created);
  }
  return created;
}

/**
 * Builds a complete composite 4-part procedural 3D polyhedral die:
 * 1) Primary glossy clearcoat resin polyhedron body (MeshPhysicalMaterial with micro-grain roughness)
 * 2) True 3D metallic edge bevel frame (merged strut BufferGeometry with high metalness / low roughness)
 * 3) Crisp rim highlight line accent (EdgesGeometry + LineSegments)
 * 4) Per-face oriented engraved number decals flush on every face
 */
export function buildPolyhedralDieGroup(
  sides: PolyhedralDieSides,
  colorHex: string,
  maxAnisotropy = 4,
  radius = 0.56
): BuiltDieModel {
  const group = new THREE.Group();
  const baseGeo = createBasePolyhedronGeometry(sides, radius);
  const faces = extractPolyhedronFaces(baseGeo, sides);

  const baseColor = new THREE.Color(colorHex);
  const deepBodyColor = baseColor.clone().multiplyScalar(0.56);
  const bevelMetallicColor = baseColor.clone().lerp(new THREE.Color('#f1f5f9'), 0.62);
  const rimHighlightColor = baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.55);

  const roughnessMap = getSharedResinRoughnessTexture();

  // Part 1: Glossy dark-tinted resin/gemstone polyhedral body (higher roughness contrast vs metallic bevels)
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: deepBodyColor,
    roughness: 0.44,
    roughnessMap,
    metalness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    ior: 1.52,
    reflectivity: 0.92,
    emissive: baseColor.clone().multiplyScalar(0.14),
    emissiveIntensity: 0.58,
    flatShading: true,
  });

  const bodyMesh = new THREE.Mesh(baseGeo, bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.name = 'die-body';
  group.add(bodyMesh);

  // Part 2: True 3D metallic edge bevel frame (high metalness, low roughness -> >= 0.25 roughness contrast)
  const edgesGeo = new THREE.EdgesGeometry(baseGeo, 12);
  const strutRadius = Math.max(0.011, radius * 0.025);
  const bevelFrameGeo = createMetallicBevelFrameGeometry(edgesGeo, strutRadius);
  const bevelMaterial = new THREE.MeshStandardMaterial({
    color: bevelMetallicColor,
    metalness: 0.9,
    roughness: 0.16,
    emissive: baseColor.clone().multiplyScalar(0.08),
    emissiveIntensity: 0.35,
  });
  const bevelMesh = new THREE.Mesh(bevelFrameGeo, bevelMaterial);
  bevelMesh.name = 'die-bevel-frame';
  group.add(bevelMesh);

  // Part 3: Crisp luminous rim hairline overlay for hover/drag feedback
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: rimHighlightColor,
    transparent: true,
    opacity: 0.42,
  });
  const edgeLines = new THREE.LineSegments(edgesGeo, edgeMaterial);
  edgeLines.scale.setScalar(1.012);
  edgeLines.name = 'die-edges';
  group.add(edgeLines);

  // Part 4: Per-face oriented engraved number decals
  const decalGeometries: THREE.PlaneGeometry[] = [];
  const decalMaterials: THREE.MeshBasicMaterial[] = [];

  const decalScaleBySides: Record<PolyhedralDieSides, number> = {
    4: 0.84,
    6: 1.14,
    8: 0.94,
    10: 0.78,
    12: 0.98,
    20: 0.9,
  };
  const scaleFactor = decalScaleBySides[sides];

  const zAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const xAxis = new THREE.Vector3();
  const basisMat = new THREE.Matrix4();

  for (const face of faces) {
    const tex = getCachedFaceTexture(face.value, sides, colorHex, maxAnisotropy);
    if (!tex) continue;

    const decalSize = Math.max(0.22, face.inradius * scaleFactor);
    const planeGeo = new THREE.PlaneGeometry(decalSize, decalSize);
    const decalMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const decalMesh = new THREE.Mesh(planeGeo, decalMat);
    decalMesh.position.copy(face.center).addScaledVector(face.normal, 0.013);

    zAxis.copy(face.normal).normalize();
    yAxis.copy(face.up).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    yAxis.crossVectors(zAxis, xAxis).normalize();
    basisMat.makeBasis(xAxis, yAxis, zAxis);
    decalMesh.quaternion.setFromRotationMatrix(basisMat);
    decalMesh.renderOrder = 2;

    group.add(decalMesh);
    decalGeometries.push(planeGeo);
    decalMaterials.push(decalMat);
  }

  const dispose = () => {
    baseGeo.dispose();
    edgesGeo.dispose();
    bevelFrameGeo.dispose();
    bodyMaterial.dispose();
    bevelMaterial.dispose();
    edgeMaterial.dispose();
    for (const g of decalGeometries) g.dispose();
    for (const m of decalMaterials) m.dispose();
  };

  return {
    group,
    faces,
    radius,
    bodyMaterial,
    bevelMaterial,
    edgeMaterial,
    dispose,
  };
}
