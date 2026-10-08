import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { attachBirthTimes, createGrowth, createGrowthCap } from '../app/src/growth';
import { createSurface } from '../app/src/geometry';

describe('路径显露与阴影', () => {
  it('按 UV 指定轴生成出生时间，支持根部反向生长', () => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    attachBirthTimes(geometry, { start: 2, end: 5 }, 'y');
    const uv = geometry.getAttribute('uv'), birth = geometry.getAttribute('birthTime');
    for (let i = 0; i < uv.count; i++) expect(birth.getX(i)).toBeCloseTo(2 + uv.getY(i) * 3);
    attachBirthTimes(geometry, { start: 2, end: 5, reverse: true }, 'x');
    for (let i = 0; i < uv.count; i++) expect(geometry.getAttribute('birthTime').getX(i)).toBeCloseTo(5 - uv.getX(i) * 3);
  });
  it('显示材质、深度与距离阴影共享同一个时间 uniform', () => {
    const growth = createGrowth();
    const surface = growth.material(new THREE.MeshStandardMaterial());
    for (const material of [surface, growth.depth, growth.distance]) {
      const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <clipping_planes_fragment>' };
      material.onBeforeCompile(shader as never, {} as never);
      expect(shader.uniforms).toHaveProperty('uGrowthTime', growth.time);
      expect(shader.fragmentShader).toContain('discard');
      expect(shader.vertexShader).toContain('birthTime');
    }
    growth.time.value = 4;
    expect(surface.customProgramCacheKey()).toBe('woven-growth-v1');
  });
  it('生长截面封口随时间移动，结束和静态时隐藏', () => {
    const cap = createGrowthCap(createSurface([[0, 0, 0], [0, 3, 0]], [1, 0.5]), { start: 1, end: 4 }, new THREE.MeshStandardMaterial());
    cap.update(0); expect(cap.mesh.visible).toBe(false);
    cap.update(2.5); expect(cap.mesh.visible).toBe(true);
    const position = cap.mesh.geometry.getAttribute('position');
    expect(position.getY(0)).toBeCloseTo(1.5);
    expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
    const before = Array.from(position.array);
    cap.update(3); cap.update(2.5); expect(Array.from(position.array)).toEqual(before);
    cap.update(4); expect(cap.mesh.visible).toBe(false);
    cap.update(100); expect(cap.mesh.visible).toBe(false);
  });
});
