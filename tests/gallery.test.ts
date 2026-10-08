import { describe, expect, it } from 'vitest';
import { DirectionalLight, Mesh } from 'three';
import { createGallery } from '../app/src/gallery';

describe('暖光艺术馆舞台', () => {
  it('无缝背景几何有效且有真正的弧形过渡', () => {
    const gallery = createGallery();
    const backdrop = gallery.getObjectByName('无缝暖灰展厅') as Mesh;
    expect(backdrop).toBeInstanceOf(Mesh);
    for (const attribute of ['position', 'normal', 'uv']) {
      expect(backdrop.geometry.getAttribute(attribute).array.every(Number.isFinite)).toBe(true);
    }
    backdrop.geometry.computeBoundingBox();
    expect(backdrop.geometry.boundingBox!.max.y).toBeGreaterThan(30);
    expect(backdrop.receiveShadow).toBe(true);
    expect(backdrop.customDepthMaterial).toBeDefined();
  });
  it('侧上主光有柔和阴影，补光弱于主光，底座有接触阴影', () => {
    const gallery = createGallery();
    const key = gallery.getObjectByName('暖色侧上主光') as DirectionalLight;
    const fill = gallery.getObjectByName('中性柔和补光') as DirectionalLight;
    expect(key.castShadow).toBe(true);
    expect(key.shadow.mapSize.x).toBeGreaterThanOrEqual(2048);
    expect(key.shadow.blurSamples).toBeGreaterThanOrEqual(8);
    expect(key.position.x).toBeLessThan(-5);
    expect(fill.intensity).toBeLessThan(key.intensity / 2);
    expect(gallery.getObjectByName('底座接触阴影')).toBeInstanceOf(Mesh);
  });
});
