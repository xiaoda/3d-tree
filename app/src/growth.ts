import * as THREE from 'three';
import { discProgress, PHASES } from './timeline';
import { surfacePoint, type TubeSurface } from './geometry';

export interface GrowthWindow { start: number; end: number; reverse?: boolean }

/** 合并前写入各条路径的出生时刻，合并后仍可独立生长。 */
export function attachBirthTimes(geometry: THREE.BufferGeometry, window: GrowthWindow, axis: 'x' | 'y') {
  const uv = geometry.getAttribute('uv');
  const times = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) {
    const v = axis === 'x' ? uv.getX(i) : uv.getY(i);
    times[i] = window.start + (window.reverse ? 1 - v : v) * (window.end - window.start);
  }
  geometry.setAttribute('birthTime', new THREE.BufferAttribute(times, 1));
}

export function createGrowth() {
  // 静态研究模式越过全部出生时间，保持旧模型外观。
  const time = { value: 100 };
  function material<T extends THREE.Material>(value: T): T {
    value.onBeforeCompile = shader => {
      shader.uniforms.uGrowthTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float birthTime;\nvarying float vBirthTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBirthTime = birthTime;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uGrowthTime;\nvarying float vBirthTime;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uGrowthTime < vBirthTime) discard;');
    };
    value.customProgramCacheKey = () => 'woven-growth-v1';
    return value;
  }
  const depth = material(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const distance = material(new THREE.MeshDistanceMaterial());
  function bind(mesh: THREE.Mesh) {
    mesh.customDepthMaterial = depth;
    mesh.customDistanceMaterial = distance;
  }
  return { time, material, depth, distance, bind };
}

/** 显露前沿补实体截面，避免生长中的树干成为空心筒。静态模式不增加外观。 */
export function createGrowthCap(surface: TubeSurface, window: GrowthWindow, material: THREE.Material) {
  const segments = 36;
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array((segments + 2) * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const normal = new THREE.BufferAttribute(new Float32Array((segments + 2) * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const uv = new THREE.BufferAttribute(new Float32Array((segments + 2) * 2), 2);
  const indices: number[] = [];
  for (let i = 1; i <= segments; i++) {
    if (window.reverse) indices.push(0, i + 1, i);
    else indices.push(0, i, i + 1);
  }
  uv.setXY(0, 0.5, 0.5);
  for (let i = 0; i <= segments; i++) uv.setXY(i + 1, 0.5 + 0.5 * Math.cos(i / segments * Math.PI * 2), 0.5 + 0.5 * Math.sin(i / segments * Math.PI * 2));
  geometry.setAttribute('position', position); geometry.setAttribute('normal', normal); geometry.setAttribute('uv', uv); geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = '生长实体截面'; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  let previous = -1;
  return {
    mesh,
    update(time: number) {
      const p = (time - window.start) / (window.end - window.start);
      mesh.visible = p > 0 && p < 1;
      if (!mesh.visible || time === previous) return;
      const t = window.reverse ? 1 - p : p;
      const center = surface.curve.getPointAt(t), n = surface.curve.getTangentAt(t).multiplyScalar(window.reverse ? -1 : 1);
      position.setXYZ(0, center.x, center.y, center.z); normal.setXYZ(0, n.x, n.y, n.z);
      for (let i = 0; i <= segments; i++) {
        const point = surfacePoint(surface, t, i / segments * Math.PI * 2);
        position.setXYZ(i + 1, point.x, point.y, point.z); normal.setXYZ(i + 1, n.x, n.y, n.z);
      }
      position.needsUpdate = normal.needsUpdate = true;
      previous = time;
    },
  };
}

/** 缓存原矩阵，不重复分解、不创建每帧临时对象；最终逐位恢复静态矩阵。 */
export function animateDiscs(mesh: THREE.InstancedMesh, index: number, rows: number[], side: number) {
  const rest = new Float32Array(mesh.instanceMatrix.array);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // 聚合路径略超出静态包围体，关闭这 18 个实例组的裁剪防止边缘闪烁。
  mesh.frustumCulled = false;
  let previous = 100;
  return (time: number) => {
    const sample = time >= PHASES[2].end ? 100 : Math.max(0, time);
    mesh.visible = sample > 10;
    if (!mesh.visible || sample === previous) return;
    const array = mesh.instanceMatrix.array;
    array.set(rest);
    if (sample < 100) {
      for (let i = 0; i < mesh.count; i++) {
        const p = discProgress(sample, index, rows[i]), k = i * 16;
        const scale = Math.max(0.00001, p);
        for (const column of [0, 4, 8]) for (let row = 0; row < 3; row++) array[k + column + row] *= scale;
        const flight = 1 - p;
        array[k + 12] += Math.sin(i * 2.399) * 0.24 * flight;
        array[k + 13] -= (0.22 + rows[i] * 0.25) * flight;
        array[k + 14] += side * (0.32 + 0.14 * Math.sin(i * 1.7)) * flight;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    previous = sample;
  };
}
