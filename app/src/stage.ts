import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTree } from './tree';
import { VIEWS, type ViewName } from './config';

export class TreeStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
  readonly controls: OrbitControls;
  readonly tree = createTree();
  time = 0;
  playing = false;
  view: ViewName = 'portrait';
  private dirty = true;
  private lastTime = 0;
  private exporting = false;
  private resizeObserver: ResizeObserver;
  private pixelRatio = Math.min(window.devicePixelRatio, 1.75);

  constructor(private canvas: HTMLCanvasElement, private frame: HTMLElement, onError: (message: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color('#e7e1d5');
    this.scene.fog = new THREE.Fog('#e7e1d5', 32, 70);
    this.scene.add(this.tree.group);

    const hemisphere = new THREE.HemisphereLight('#fff4e2', '#c8bbaa', 2.0);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight('#fff0d3', 3.2);
    key.position.set(-3, 22, 4); key.target.position.set(0, 4, 0);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
    key.shadow.bias = -0.00015; key.shadow.normalBias = 0.035;
    key.shadow.radius = 14; key.shadow.intensity = 0.7;
    this.scene.add(key, key.target);
    const fill = new THREE.DirectionalLight('#dfe9e3', 1.1);
    fill.position.set(7, 7, -5); this.scene.add(fill);
    const frontFill = new THREE.DirectionalLight('#fff7ee', 0.5);
    frontFill.position.set(2, 4, 12); this.scene.add(frontFill);
    const rearFill = new THREE.DirectionalLight('#f3e1e7', 0.65);
    rearFill.position.set(-9, 7, -11); this.scene.add(rearFill);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: '#e4ddd0', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.012; ground.receiveShadow = true;
    this.scene.add(ground);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.2; this.controls.maxDistance = 38;
    // 允许站在树冠下仰视；旧的 0.49π 会把参考镜头强行抬到目标上方。
    this.controls.maxPolarAngle = Math.PI * 0.68;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.setView('portrait');
    this.tree.update(0);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(frame); this.resize();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.playing = false; this.renderer.setAnimationLoop(null);
      onError('三维渲染上下文已丢失。请刷新页面重试；如反复出现，可关闭本页面的其他副本。');
    });
    this.renderer.setAnimationLoop(timestamp => {
      const delta = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.1) : 0;
      this.lastTime = timestamp;
      if (this.exporting || document.hidden) return;
      if (this.playing) {
        this.time += delta; this.tree.update(this.time); this.dirty = true;
      }
      this.controls.update();
      if (this.camera.position.y < 0.25) {
        this.camera.position.y = 0.25;
        this.controls.update();
        this.dirty = true;
      }
      if (this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; }
    });
  }

  private resize() {
    if (this.exporting) return;
    const { width, height } = this.frame.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  setView(name: ViewName) {
    if (!(name in VIEWS)) throw new Error(`未知镜头：${name}`);
    const preset = VIEWS[name]; this.view = name;
    // 清除残留的旋转惯性，确保镜头预设和截图可重复。
    this.controls.enableDamping = false; this.controls.update();
    this.camera.position.set(...preset.position); this.camera.fov = preset.fov;
    this.controls.target.set(...preset.target);
    this.camera.updateProjectionMatrix(); this.controls.update();
    this.controls.enableDamping = true; this.dirty = true;
  }

  renderAt(time: number) {
    if (!Number.isFinite(time) || time < 0) throw new Error('时间必须是非负有限数值');
    this.time = time; this.tree.update(time);
    this.renderer.render(this.scene, this.camera); this.dirty = false;
  }

  togglePlay() { this.playing = !this.playing; return this.playing; }

  captureDataUrl(width = 1920, height = 1080): string {
    if (this.exporting) throw new Error('正在导出，请稍候');
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width > 3840 || height > 2160) {
      throw new Error('导出尺寸必须为 16–3840 × 16–2160 之间的整数');
    }
    this.exporting = true;
    const aspect = this.camera.aspect;
    try {
      this.renderer.setPixelRatio(1); this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
      return this.canvas.toDataURL('image/png');
    } finally {
      this.renderer.setPixelRatio(this.pixelRatio);
      this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
      this.exporting = false; this.resize();
      this.renderer.render(this.scene, this.camera);
    }
  }

  inspect() {
    const info = this.renderer.info;
    return {
      ready: true, time: this.time, playing: this.playing, view: this.view,
      ...this.tree.stats,
      triangles: info.render.triangles, drawCalls: info.render.calls,
      geometries: info.memory.geometries, textures: info.memory.textures,
      camera: this.camera.position.toArray(),
      viewport: [this.canvas.width, this.canvas.height],
    };
  }

  dispose() {
    this.renderer.setAnimationLoop(null); this.resizeObserver.disconnect(); this.controls.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      }
    });
    materials.forEach(material => {
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
      material.dispose();
    });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose();
  }
}
