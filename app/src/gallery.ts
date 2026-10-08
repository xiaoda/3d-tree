import * as THREE from 'three';

export const GALLERY = {
  background: '#ddd3c2',
  exposure: 1.04,
  shadowType: THREE.VSMShadowMap,
} as const;

/** 地面与墙面通过四分之一圆弧相接，没有水平硬接缝。 */
function cyclorama() {
  const profile: [number, number][] = [[80, -0.018], [-16, -0.018]];
  for (let i = 1; i <= 48; i++) {
    const angle = i / 48 * Math.PI / 2;
    profile.push([-16 - 20 * Math.sin(angle), -0.018 + 20 * (1 - Math.cos(angle))]);
  }
  profile.push([-36, 65]);
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  profile.forEach(([z, y], i) => {
    positions.push(-100, y, z, 100, y, z);
    uvs.push(0, i / (profile.length - 1), 1, i / (profile.length - 1));
    if (i < profile.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function contactShadow() {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    const at = (y * size + x) * 4;
    data[at] = 58; data[at + 1] = 40; data[at + 2] = 28;
    data[at + 3] = Math.round(Math.exp(-radius * radius * 5) * (1 - THREE.MathUtils.smoothstep(radius, 0.7, 1)) * 95);
  }
  const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.LinearFilter; map.needsUpdate = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 9.7), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.name = '底座接触阴影'; mesh.rotation.x = -Math.PI / 2; mesh.position.y = -0.012;
  return mesh;
}

export function createGallery(): THREE.Group {
  const group = new THREE.Group(); group.name = '暖光艺术馆';
  const hemisphere = new THREE.HemisphereLight('#fff4e6', '#71665b', 0.95);
  hemisphere.name = '展厅漫射天光'; group.add(hemisphere);
  const key = new THREE.DirectionalLight('#ffebcc', 3.15);
  key.name = '暖色侧上主光'; key.position.set(-9, 16, 9); key.target.position.set(0, 3.7, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 55 });
  key.shadow.bias = -0.00008; key.shadow.normalBias = 0.025;
  key.shadow.radius = 65; key.shadow.blurSamples = 24; key.shadow.intensity = 0.65;
  group.add(key, key.target);
  const fill = new THREE.DirectionalLight('#e2e9ee', 1.05);
  fill.name = '中性柔和补光'; fill.position.set(8, 7, 12); group.add(fill);
  const rim = new THREE.DirectionalLight('#ffdfac', 1.8);
  rim.name = '暖色轮廓光'; rim.position.set(4, 12, -9); rim.target.position.set(0, 4, 0); group.add(rim, rim.target);
  const rear = new THREE.DirectionalLight('#eadcc9', 0.55);
  rear.name = '背面细节补光'; rear.position.set(-10, 6, -8); group.add(rear);
  const backdropMaterial = new THREE.MeshStandardMaterial({ color: '#d7cdbd', roughness: 1, dithering: true });
  // 地面淡淡的暖光池与暗一些的四周：固定在世界坐标中，运镜时不会随屏幕漂移。
  backdropMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGalleryPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGalleryPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGalleryPosition;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 galleryUV = vGalleryPosition.xz / vec2(16.0, 21.0);
        float galleryPool = exp(-dot(galleryUV, galleryUV) * 1.1);
        diffuseColor.rgb *= mix(vec3(0.77, 0.79, 0.81), vec3(1.12, 1.10, 1.06), galleryPool);
      `);
  };
  backdropMaterial.customProgramCacheKey = () => 'warm-gallery-pool-v1';
  const backdrop = new THREE.Mesh(cyclorama(), backdropMaterial);
  backdrop.name = '无缝暖灰展厅'; backdrop.receiveShadow = true;
  // VSM 会把 receiveShadow 物体也写入深度图。无限背景不应成为遮挡体，
  // 否则阴影相机边界处会留下斜线，且大半径滤波会把地面自己的深度混进去。
  const backdropDepth = new THREE.MeshDepthMaterial();
  backdropDepth.onBeforeCompile = shader => {
    shader.uniforms.uGalleryReceiverOnly = { value: 1 };
    // 使用 uniform 条件，保留片元输出声明；无条件 discard 会被部分驱动
    // 优化掉输出，触发 Active draw buffers with missing fragment shader outputs。
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGalleryReceiverOnly;')
      .replace('#include <clipping_planes_fragment>', 'if (uGalleryReceiverOnly > 0.5) discard;');
  };
  backdropDepth.customProgramCacheKey = () => 'gallery-receiver-only-v1';
  backdrop.customDepthMaterial = backdropDepth;
  group.add(backdrop, contactShadow());
  return group;
}
