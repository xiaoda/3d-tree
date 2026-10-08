import { describe, expect, it } from 'vitest';
import { createSurface, surfaceGeometry, leafGeometry } from '../app/src/geometry';

describe('三维几何有效性', () => {
  it('拒绝不匹配的路径与截面数据', () => {
    expect(() => createSurface([[0, 0, 0], [0, 1, 0]], [1])).toThrow();
  });
  it('树干坐标、法线和索引有效', () => {
    const g = surfaceGeometry(createSurface([[0, 0, 0], [0.2, 2, 0], [0.5, 4, 0.2]], [1, 0.6, 0.2]));
    for (const attr of ['position', 'normal', 'uv']) expect(Array.from(g.getAttribute(attr).array).every(Number.isFinite)).toBe(true);
    expect(Math.max(...g.index!.array)).toBeLessThan(g.getAttribute('position').count);
    expect(g.boundingBox!.max.y).toBeGreaterThan(3.5);
    g.dispose();
  });
  it('树干外表面法线朝外，而不是被背面剔除的空心壳', () => {
    const g = surfaceGeometry(createSurface([[0, 0, 0], [0, 2, 0]], [1, 1], 16, 0), 24);
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let j = 0; j < 24; j++) {
      const i = 8 * 25 + j;
      expect(p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i)).toBeGreaterThan(0.9);
    }
    g.dispose();
  });
  it.each(['oak', 'round', 'lance'] as const)('%s 叶片有厚度且坐标有限', kind => {
    const g = leafGeometry(kind, 1, 3, 0.3);
    expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    expect(Array.from(g.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    expect(g.boundingBox!.max.z - g.boundingBox!.min.z).toBeGreaterThan(0.04);
    expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeGreaterThan(1);
    g.dispose();
  });
});
