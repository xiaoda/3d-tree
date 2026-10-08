import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEAVES, PALETTE, SEED, type Triple } from './config';
import { breathingPose, leafSurface, leafWidth, seededRandom } from './procedural';
import { createSurface, surfaceGeometry, surfacePoint, tubeFromPoints, leafGeometry, type TubeSurface } from './geometry';
import { animateDiscs, attachBirthTimes, createGrowth, createGrowthCap, type GrowthWindow } from './growth';
import { leafProgress, leafStart, normalizeTime, progress, type StudioMode } from './timeline';

export interface ArtTree {
  group: THREE.Group;
  leaves: THREE.Group[];
  update: (time: number, mode?: StudioMode) => void;
  stats: { leaves: number; discs: number; fibers: number; crownSpan: number[] };
}

function makeGrain(seed: number, type: 'bark' | 'cloth'): THREE.DataTexture {
  const width = 128, height = 256, random = seededRandom(seed);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const grain = type === 'bark'
        ? Math.sin(x * 0.85 + Math.sin(y * 0.023) * 2) * 30 + Math.sin(x * 2.5) * 12
        : Math.sin(x * Math.PI / 2) * 15 + Math.sin(y * Math.PI / 2) * 13;
      data[y * width + x] = Math.round(125 + grain + (random() - 0.5) * 55);
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RedFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(type === 'bark' ? 2 : 3, type === 'bark' ? 3 : 6);
  texture.needsUpdate = true;
  return texture;
}

function addMerged(group: THREE.Group, geometries: THREE.BufferGeometry[], material: THREE.Material, name: string) {
  if (!geometries.length) return;
  const merged = mergeGeometries(geometries);
  geometries.forEach(g => g.dispose());
  if (!merged) throw new Error(`几何合并失败：${name}`);
  merged.computeBoundingSphere();
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createTree(): ArtTree {
  const group = new THREE.Group(); group.name = '织生 · 艺术树';
  const random = seededRandom(SEED);
  const growth = createGrowth();
  const discUpdates: ((time: number) => void)[] = [];
  const capUpdates: ((time: number) => void)[] = [];
  const barkGrain = makeGrain(SEED + 1, 'bark'), clothGrain = makeGrain(SEED + 2, 'cloth');
  const capMaterial = new THREE.MeshStandardMaterial({ color: '#987153', roughness: 0.98, side: THREE.DoubleSide, bumpMap: barkGrain, bumpScale: 0.025 });
  const barkMaterial = growth.material(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.98, bumpMap: barkGrain, bumpScale: 0.075 }));
  const fiberMaterials = PALETTE.fibers.map(() => growth.material(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, bumpMap: clothGrain, bumpScale: 0.025 })));
  const fiberGeometries: THREE.BufferGeometry[][] = PALETTE.fibers.map(() => []);
  const textileColors = PALETTE.fibers.map(color => new THREE.Color(color));
  const coloredFiber = (geometry: THREE.BufferGeometry, index: number, phase: number, timing: GrowthWindow) => {
    attachBirthTimes(geometry, timing, 'x');
    const uv = geometry.getAttribute('uv'), colors = new Float32Array(uv.count * 3);
    const base = textileColors[index], next = textileColors[(index + 1) % textileColors.length];
    for (let i = 0; i < uv.count; i++) {
      const t = uv.getX(i);
      const mix = 0.18 + 0.17 * Math.sin(t * 8 + phase);
      const shade = 0.87 + 0.12 * Math.sin(t * 19 + phase) + 0.04 * Math.sin(t * 87);
      const color = base.clone().lerp(next, mix).multiplyScalar(shade);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    fiberGeometries[index].push(geometry);
  };
  let fiberCount = 0, discCount = 0;

  const trunk = createSurface(
    [[0, 0.19, 0], [-0.27, 1.1, 0.04], [-0.3, 2.65, -0.12], [0.08, 4.15, 0], [0.3, 5.3, -0.2], [0.18, 6.65, -0.12]],
    [1.38, 1.14, 0.89, 0.81, 0.67, 0.31], 110, 0.075,
  );

  function addWood(surface: TubeSurface, name: string, timing: GrowthWindow) {
    const geometry = surfaceGeometry(surface), uv = geometry.getAttribute('uv');
    const woodTiming = { ...timing, start: timing.start + 0.22, end: timing.end + 0.22 };
    attachBirthTimes(geometry, woodTiming, 'y');
    const cap = createGrowthCap(surface, woodTiming, capMaterial);
    group.add(cap.mesh); capUpdates.push(cap.update);
    const colors = new Float32Array(uv.count * 3), darkWood = new THREE.Color('#584037');
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      const flow = ((u * 2.25 + v * 0.18 + 0.16 * Math.sin(v * 6 + u * 7)) % 1 + 1) % 1;
      const color = darkWood.clone().lerp(textileColors[Math.floor(flow * textileColors.length)], 0.38 + 0.22 * Math.sin(u * 13 + v * 9) ** 2);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, barkMaterial);
    mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
    growth.bind(mesh);
    group.add(mesh);
  }

  const knots = [
    { t: 0.32, angle: 3.55, height: 0.08, width: 0.36 }, { t: 0.65, angle: 3.0, height: 0.075, width: 0.32 },
    { t: 0.47, angle: 1.25, height: 0.095, width: 0.38 }, { t: 0.72, angle: 0.15, height: 0.065, width: 0.30 },
    { t: 0.26, angle: 5.2, height: 0.073, width: 0.35 }, { t: 0.72, angle: 4.8, height: 0.06, width: 0.27 },
  ];
  function addFibers(surface: TubeSurface, timing: GrowthWindow, count: number, size: number, twist: number, lengthSegments = 72, withKnots = false) {
    for (let i = 0; i < count; i++) {
      const initial = (i + random() * 0.24) / count * Math.PI * 2;
      const thickness = size * (0.58 + random() * 0.64), points: THREE.Vector3[] = [];
      const drift = random() * Math.PI * 2;
      for (let j = 0; j <= lengthSegments; j++) {
        const t = j / lengthSegments;
        let angle = initial + twist * t + Math.sin(t * 7 + drift) * 0.035;
        if (withKnots) for (const knot of knots) {
          const delta = Math.atan2(Math.sin(angle - knot.angle), Math.cos(angle - knot.angle));
          const influence = Math.exp(-Math.pow((t - knot.t) / (knot.height * 1.08), 2)) * Math.exp(-Math.pow(delta / 0.48, 2));
          angle += Math.sign(delta) * knot.width * 1.22 * influence;
        }
        points.push(surfacePoint(surface, t, angle, thickness * 0.54));
      }
      // 色带以成组变化为主，避免整根树干均匀糖果条纹。
      const band = Math.floor(((i / count + 0.1) * 2.25 + Math.sin(initial * 3) * 0.045) % 1 * PALETTE.fibers.length);
      const index = Math.abs(band + (random() < 0.22 ? 1 : 0)) % PALETTE.fibers.length;
      const stagger = (i * 7 % 19) / 19 * 0.18;
      coloredFiber(tubeFromPoints(points, thickness, lengthSegments, 5), index, initial, { ...timing, start: timing.start + stagger, end: timing.end + stagger });
      fiberCount++;
    }
  }
  const trunkTiming = { start: 0.65, end: 5.4 };
  addWood(trunk, '连续树干', trunkTiming);
  addFibers(trunk, trunkTiming, 288, 0.026, 1.12, 104, true);
  addFibers(trunk, trunkTiming, 28, 0.043, 1.12, 104, true);
  for (const knot of knots) {
    for (let ring = 0; ring < 12; ring++) {
      const scale = (ring + 1) / 12, points: THREE.Vector3[] = [];
      for (let j = 0; j <= 64; j++) {
        const a = j / 64 * Math.PI * 2;
        const t = knot.t + Math.sin(a) * knot.height * scale;
        const angle = knot.angle + Math.cos(a) * knot.width * scale * (0.94 + 0.06 * Math.sin(a * 3));
        points.push(surfacePoint(trunk, t, angle, 0.017 + scale * 0.003));
      }
      const start = 0.95 + knot.t * 4.75 + ring * 0.016;
      coloredFiber(tubeFromPoints(points, 0.019, 64, 5), [2, 5, 12, 6, 0, 9][ring % 6], knot.angle, { start, end: start + 0.65 });
      fiberCount++;
    }
  }

  // 根脊从主体内部生出，贴地逐渐变细。
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2 + 0.18 + Math.sin(i * 4) * 0.075;
    const end = 2.25 + random() * 0.92;
    const points: Triple[] = [
      [-0.17, 1.48 + random() * 0.55, 0],
      [Math.cos(angle) * 1.02, 0.64, Math.sin(angle) * 1.02],
      [Math.cos(angle + 0.10) * 1.92, 0.29, Math.sin(angle + 0.10) * 1.86],
      [Math.cos(angle + 0.20) * end, 0.16, Math.sin(angle + 0.20) * end * 0.95],
    ];
    const root = createSurface(points, [0.48, 0.4, 0.20, 0.035], 44, 0.08);
    const timing = { start: 0.05 + i * 0.025, end: 2.3 + i * 0.025, reverse: true };
    addWood(root, `根脊 ${i + 1}`, timing); addFibers(root, timing, 20, 0.018, 0.42, 42);
  }

  // 全周主枝及逐叶承托枝；从树干内部起笔，隐藏关节断口。
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + 0.1;
    const points: Triple[] = [[0.08, 3.65 + (i % 3) * 0.29, 0], [Math.cos(a) * 0.95, 4.85, Math.sin(a) * 0.95], [Math.cos(a + 0.13) * 2.4, 6.0 + (i % 3) * 0.23, Math.sin(a + 0.13) * 2.4], [Math.cos(a + 0.18) * 4.6, 7.0 + (i % 2) * 0.5, Math.sin(a + 0.18) * 4.6]];
    const surface = createSurface(points, [0.5, 0.36, 0.22, 0.06], 56, 0.065);
    const timing = { start: 4.0 + (i % 3) * 0.12, end: 6.5 + (i % 3) * 0.12 };
    addWood(surface, `主枝 ${i + 1}`, timing); addFibers(surface, timing, 30, 0.019, 0.65, 52);
  }
  LEAVES.forEach((spec, i) => {
    const [x, y, z] = spec.base;
    const surface = createSurface([[0.13, 4.8, -0.05], [x * 0.55, y - 0.6, z * 0.55], spec.base], [0.23, 0.13, 0.046], 28, 0.035);
    const timing = { start: 4.7 + (i % 6) * 0.05, end: leafStart(i) - 0.24 };
    addWood(surface, `叶片承托 ${i + 1}`, timing); addFibers(surface, timing, 8, 0.015, 0.25, 26);
  });
  fiberGeometries.forEach((geometries, i) => {
    const mesh = addMerged(group, geometries, fiberMaterials[i], `彩色纤维 ${i + 1}`);
    if (mesh) growth.bind(mesh);
  });

  const leaves: THREE.Group[] = [];
  const discGeometry = new THREE.CylinderGeometry(1, 0.92, 0.3, 7);
  discGeometry.rotateX(Math.PI / 2);
  const discMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, metalness: 0.02, bumpMap: clothGrain, bumpScale: 0.012 });
  const matrixDummy = new THREE.Object3D();
  const discColors = PALETTE.discs.map(c => new THREE.Color(c));

  LEAVES.forEach((spec, index) => {
    const leaf = new THREE.Group(); leaf.name = `雕塑叶片 ${index + 1}`;
    const direction = new THREE.Vector3(...spec.tip).sub(new THREE.Vector3(...spec.base));
    const length = direction.length();
    leaf.position.set(...spec.base);
    const yAxis = direction.normalize();
    const face = new THREE.Vector3(...spec.facing);
    const zAxis = face.addScaledVector(yAxis, -face.dot(yAxis)).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    leaf.rotateY(spec.roll);
    leaf.userData.restQuaternion = leaf.quaternion.clone();
    const geometry = leafGeometry(spec.kind, spec.width, length, spec.curl, 0.075);
    const uv = geometry.getAttribute('uv'), colors = new Float32Array(uv.count * 3), baseColor = new THREE.Color(spec.color);
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      const shade = 0.86 + 0.11 * Math.sin(v * 6.5 + u * 2) + 0.045 * Math.cos(u * 22 + v * 35);
      baseColor.clone().multiplyScalar(shade).toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, bumpMap: clothGrain, bumpScale: 0.032 });
    const body = new THREE.Mesh(geometry, material);
    body.name = '叶片实体'; body.castShadow = body.receiveShadow = true;
    leaf.add(body);

    for (const side of [1, -1]) {
    const veinGeometries: THREE.BufferGeometry[] = [];
    const midrib: THREE.Vector3[] = [];
    for (let j = 0; j <= 24; j++) {
      const v = j / 24, point = leafSurface(0, v, 0, length, spec.curl);
      midrib.push(new THREE.Vector3(point[0], point[1], point[2] + side * 0.085));
    }
    veinGeometries.push(tubeFromPoints(midrib, 0.055, 40, 7));
    for (const v0 of [0.2, 0.36, 0.52, 0.68, 0.81]) {
      for (const sign of [-1, 1]) {
        const points: THREE.Vector3[] = [];
        for (let step = 0; step <= 10; step++) {
          const t = step / 10, v = v0 + t * (0.1 - v0 * 0.028);
          const u = sign * t * 0.88;
          const p = leafSurface(u, v, leafWidth(v, spec.kind) * spec.width, length, spec.curl);
          points.push(new THREE.Vector3(p[0], p[1], p[2] + side * 0.078));
        }
        veinGeometries.push(tubeFromPoints(points, 0.034, 12, 5));
      }
    }
    addMerged(leaf, veinGeometries, new THREE.MeshStandardMaterial({ color: spec.vein, roughness: 0.9, bumpMap: clothGrain, bumpScale: 0.019 }), side === 1 ? '立体叶脉' : '背面叶脉');
    }

    // 缝线式边缘勾勒，使厚片而非纸片的形态更清楚。
    const edgeGeometries: THREE.BufferGeometry[] = [];
    for (const sign of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 70; j++) {
        const v = 0.005 + j / 70 * 0.99;
        const p = leafSurface(sign * 0.995, v, leafWidth(v, spec.kind) * spec.width, length, spec.curl);
        points.push(new THREE.Vector3(p[0], p[1], p[2]));
      }
      edgeGeometries.push(tubeFromPoints(points, 0.037, 80, 5));
    }
    addMerged(leaf, edgeGeometries, new THREE.MeshStandardMaterial({ color: spec.vein, roughness: 0.95 }), '手工叶缘');

    if (spec.confetti) {
      const samples: { u: number; v: number; radius: number }[] = [];
      // 交错行加小扰动：覆盖充分而不发生纯随机的大片空洞和严重堆叠。
      const step = 0.135;
      for (let y = 0.09, row = 0; y < length - 0.06; y += step * 0.83, row++) {
        const v = y / length, w = leafWidth(v, spec.kind) * spec.width;
        for (let x = -w + step * 0.55 + (row % 2) * step * 0.5; x < w - step * 0.5; x += step) {
          const px = x + (random() - 0.5) * step * 0.28;
          if (Math.abs(px) < 0.06 || w < 0.06) continue;
          samples.push({ u: px / w, v: v + (random() - 0.5) * 0.003, radius: 0.060 + random() * 0.019 });
        }
      }
      for (const side of [1, -1]) {
      const discs = new THREE.InstancedMesh(discGeometry, discMaterial, samples.length);
      discs.name = side === 1 ? '叶面手工圆片' : '背面手工圆片'; discs.castShadow = false; discs.receiveShadow = true;
      samples.forEach((sample, i) => {
        const w = leafWidth(sample.v, spec.kind) * spec.width;
        const p = leafSurface(sample.u, sample.v, w, length, spec.curl);
        matrixDummy.position.set(p[0], p[1], p[2] + side * (0.061 + random() * 0.019));
        matrixDummy.rotation.set((random() - 0.5) * 0.28, sample.u * 0.19 + (random() - 0.5) * 0.2, random() * Math.PI);
        matrixDummy.scale.set(sample.radius, sample.radius, sample.radius);
        matrixDummy.updateMatrix();
        discs.setMatrixAt(i, matrixDummy.matrix);
        const color = discColors[Math.floor(random() * discColors.length)].clone();
        if (spec.color === '#a9ac70') color.lerp(new THREE.Color('#849666'), 0.42);
        discs.setColorAt(i, color);
      });
      discs.computeBoundingBox(); discs.computeBoundingSphere();
      discUpdates.push(animateDiscs(discs, index, samples.map(sample => sample.v), side));
      leaf.add(discs); discCount += samples.length;
      }
    }
    // 叶柄也作为局部几何跟随叶片。
    const petiole = tubeFromPoints([new THREE.Vector3(0, -0.24, 0), new THREE.Vector3(0, 0, 0.04), new THREE.Vector3(0, 0.3, 0.07)], 0.052, 12, 7);
    const petioleMesh = new THREE.Mesh(petiole, new THREE.MeshStandardMaterial({ color: '#b59b68', roughness: 0.95 })); petioleMesh.castShadow = true;
    leaf.add(petioleMesh);
    leaves.push(leaf); group.add(leaf);
  });

  // 多色、微起伏的叠层年轮，而非同心的单色平面贴片。
  const ringColors = ['#48393e', '#846063', '#ba9080', '#775668', '#bb98ad', '#605266', '#9691a0', '#d4b7a2', '#9c6b57', '#d0a66f', '#e0c6a0', '#787c61', '#b7bc95', '#8a7373', '#564249'];
  ringColors.forEach((color, i) => {
    const shape = new THREE.Shape(), scale = 1 - i * 0.038;
    for (let j = 0; j <= 100; j++) {
      const a = j / 100 * Math.PI * 2;
      const radius = 1 + Math.sin(a * 3 + 0.3 + i * 0.018) * 0.09 + Math.sin(a * 7 + i * 0.04) * 0.04;
      const x = Math.cos(a) * 3.78 * radius * scale + Math.sin(i * 0.17) * 0.08, y = Math.sin(a) * 3.15 * radius * scale;
      if (j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.008, bevelSegments: 1, steps: 1 }), new THREE.MeshStandardMaterial({ color, roughness: 1, bumpMap: clothGrain, bumpScale: 0.025 }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.012 + i * 0.008;
    mesh.receiveShadow = true; mesh.name = `叠层年轮 ${i + 1}`; group.add(mesh);
  });

  const offset = new THREE.Quaternion(), euler = new THREE.Euler();
  const crownBounds = new THREE.Box3();
  leaves.forEach(leaf => crownBounds.union(new THREE.Box3().setFromObject(leaf)));
  return {
    group, leaves,
    stats: { leaves: leaves.length, discs: discCount, fibers: fiberCount, crownSpan: [crownBounds.max.x - crownBounds.min.x, crownBounds.max.z - crownBounds.min.z] },
    update(time, mode = 'study') {
      if (!Number.isFinite(time)) throw new Error('时间必须是有限数值');
      const film = mode === 'film', t = film ? normalizeTime(time) : time;
      growth.time.value = film ? t : 100;
      capUpdates.forEach(update => update(film ? t : 100));
      discUpdates.forEach(update => update(film ? t : 100));
      leaves.forEach((leaf, i) => {
        const unfold = film ? leafProgress(t, i) : 1;
        leaf.visible = unfold > 0;
        leaf.scale.set(0.035 + 0.965 * unfold, 0.12 + 0.88 * unfold, 0.3 + 0.7 * unfold);
        const pose = breathingPose(t, i), breath = film ? progress(t, 8.5, 11) : 1;
        euler.set(pose.x * breath + (1 - unfold) * -0.72, (1 - unfold) * (i % 2 ? 0.24 : -0.24), pose.z * breath);
        offset.setFromEuler(euler);
        leaf.quaternion.copy(leaf.userData.restQuaternion as THREE.Quaternion).multiply(offset);
      });
    },
  };
}
