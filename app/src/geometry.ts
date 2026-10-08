import * as THREE from 'three';
import { leafSurface, leafWidth, smoothstep, type LeafKind } from './procedural';
import type { Triple } from './config';

export interface TubeSurface {
  curve: THREE.CatmullRomCurve3;
  frames: ReturnType<THREE.Curve<THREE.Vector3>['computeFrenetFrames']>;
  radii: number[];
  segments: number;
  relief: number;
}

export function createSurface(points: Triple[], radii: number[], segments = 88, relief = 0.045): TubeSurface {
  if (points.length !== radii.length || points.length < 2) throw new Error('路径与半径数量必须一致，且至少含两个点');
  if (radii.some(r => !Number.isFinite(r) || r <= 0)) throw new Error('截面半径必须为正数');
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  return { curve, frames: curve.computeFrenetFrames(segments, false), radii, segments, relief };
}

export function radiusAt(surface: TubeSurface, t: number): number {
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (surface.radii.length - 1);
  const i = Math.min(Math.floor(scaled), surface.radii.length - 2);
  return THREE.MathUtils.lerp(surface.radii[i], surface.radii[i + 1], smoothstep(scaled - i));
}

export function surfacePoint(surface: TubeSurface, t: number, angle: number, offset = 0): THREE.Vector3 {
  const at = THREE.MathUtils.clamp(t, 0, 1) * surface.segments;
  const i = Math.min(Math.floor(at), surface.segments - 1), f = at - i;
  const n = surface.frames.normals[i].clone().lerp(surface.frames.normals[i + 1], f).normalize();
  const b = surface.frames.binormals[i].clone().lerp(surface.frames.binormals[i + 1], f).normalize();
  const r = radiusAt(surface, t) * (1 + surface.relief * Math.sin(angle * 9 + t * 8) + surface.relief * 0.55 * Math.sin(angle * 17 - t * 9));
  return surface.curve.getPointAt(t).addScaledVector(n, Math.cos(angle) * (r + offset)).addScaledVector(b, Math.sin(angle) * (r + offset));
}

export function surfaceGeometry(surface: TubeSurface, radialSegments = 36): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= surface.segments; i++) {
    for (let j = 0; j <= radialSegments; j++) {
      const p = surfacePoint(surface, i / surface.segments, j / radialSegments * Math.PI * 2);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radialSegments, i / surface.segments);
      if (i < surface.segments && j < radialSegments) {
        const a = i * (radialSegments + 1) + j, b = a + radialSegments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  // 首尾封口，避免自由旋转时看到空心截面。
  for (const end of [0, 1]) {
    const center = surface.curve.getPointAt(end), ci = positions.length / 3;
    positions.push(center.x, center.y, center.z); uvs.push(0.5, end);
    const start = end * surface.segments * (radialSegments + 1);
    for (let j = 0; j < radialSegments; j++) {
      if (end === 0) indices.push(ci, start + j + 1, start + j);
      else indices.push(ci, start + j, start + j + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return geometry;
}

export function leafGeometry(kind: LeafKind, width: number, length: number, curl: number, thickness = 0.045): THREE.BufferGeometry {
  const nx = 12, ny = 56, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const layerSize = (nx + 1) * (ny + 1);
  for (let layer = 0; layer < 2; layer++) {
    for (let j = 0; j <= ny; j++) {
      const v = j / ny, halfWidth = leafWidth(v, kind) * width;
      for (let i = 0; i <= nx; i++) {
        const u = i / nx * 2 - 1;
        const p = leafSurface(u, v, halfWidth, length, curl);
        positions.push(p[0], p[1], p[2] + (layer === 0 ? thickness / 2 : -thickness / 2));
        uvs.push(i / nx, v);
        if (j < ny && i < nx) {
          const a = layer * layerSize + j * (nx + 1) + i, b = a + nx + 1;
          if (layer === 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
          else indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
  }
  for (let j = 0; j < ny; j++) {
    for (const i of [0, nx]) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      if (i === 0) indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
      else indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return geometry;
}

export function tubeFromPoints(points: THREE.Vector3[], radius: number, segments = 32, radialSegments = 5): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, radialSegments, false);
}
