import { describe, expect, it } from 'vitest';
import { RepeatWrapping, RGBAFormat } from 'three';
import { createTextileMaps } from '../app/src/textile';

describe('可复现的织物表面', () => {
  it('颜色、凹凸和粗糙度贴图有效，使用独立正确通道', () => {
    const maps = createTextileMaps(81026, 'leaf');
    for (const texture of [maps.color, maps.bump, maps.roughness]) {
      expect(texture.format).toBe(RGBAFormat);
      expect(texture.wrapS).toBe(RepeatWrapping);
      expect(texture.image.data.length).toBe(texture.image.width * texture.image.height * 4);
      expect(new Set(texture.image.data).size).toBeGreaterThan(12);
    }
    expect(maps.color).not.toBe(maps.bump);
    expect(maps.bump).not.toBe(maps.roughness);
  });
  it('同一种子纹理完全一致，纤维与叶面采用不同的 UV 比例', () => {
    const a = createTextileMaps(81026, 'leaf'), b = createTextileMaps(81026, 'leaf');
    expect(a.color.image.data).toEqual(b.color.image.data);
    expect(a.bump.image.data).toEqual(b.bump.image.data);
    const fiber = createTextileMaps(81026, 'fiber');
    expect(fiber.bump.repeat.toArray()).not.toEqual(a.bump.repeat.toArray());
  });
});
