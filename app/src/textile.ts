import * as THREE from 'three';
import { seededRandom } from './procedural';

/** 有种子的纺织表面；所有细节固定在 UV 中，不随帧变化，避免视频闪烁。 */
export function createTextileMaps(seed: number, kind: 'fiber' | 'leaf') {
  const size = 256, random = seededRandom(seed);
  const color = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = x / 8, b = y / 8;
      const warp = Math.sin((a + Math.sin(b * Math.PI / 8) * 0.055) * Math.PI * 2);
      const weft = Math.sin((b + Math.sin(a * Math.PI / 8) * 0.055) * Math.PI * 2);
      const over = (Math.floor(a) + Math.floor(b)) % 2;
      const thread = (over ? warp * 0.75 + weft * 0.25 : weft * 0.75 + warp * 0.25);
      const slub = Math.sin(x * Math.PI / 32) * Math.cos(y * Math.PI / 64);
      const noise = random() - 0.5;
      const height = 130 + thread * 36 + slub * 12 + noise * 23;
      // 染色仅有克制的明暗起伏，避免在远景形成摩尔纹。
      const dye = 231 + thread * 9 + slub * 9 + noise * 9;
      const rough = 228 - thread * 13 + noise * 15;
      for (let channel = 0; channel < 3; channel++) {
        const at = (y * size + x) * 4 + channel;
        color[at] = Math.round(dye);
        bump[at] = Math.round(height);
        roughness[at] = Math.round(rough);
      }
      color[(y * size + x) * 4 + 3] = bump[(y * size + x) * 4 + 3] = roughness[(y * size + x) * 4 + 3] = 255;
    }
  }
  const make = (data: Uint8Array, isColor = false) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = `${kind}-${isColor ? '染色' : '表面'}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    // TubeGeometry 的 U 为长度方向，V 为线束周向；叶片则 U 横向、V 纵向。
    texture.repeat.set(kind === 'fiber' ? 10 : 2, kind === 'fiber' ? 1 : 4);
    texture.needsUpdate = true;
    return texture;
  };
  return { color: make(color, true), bump: make(bump), roughness: make(roughness) };
}
