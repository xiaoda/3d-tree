import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraAt, discProgress, DURATION, FPS, frameTime, leafProgress, leafStart, normalizeTime, phaseAt } from '../app/src/timeline';

describe('15 秒绝对时间轴', () => {
  it('夹取边界，拒绝非法时间', () => {
    expect(normalizeTime(-1)).toBe(0);
    expect(normalizeTime(200)).toBe(DURATION);
    for (const value of [NaN, Infinity, -Infinity]) expect(() => normalizeTime(value)).toThrow();
  });
  it('四段分镜边界明确，末尾停留', () => {
    expect(DURATION).toBe(15);
    expect([0, 4, 10, 13, 15].map(t => phaseAt(t).id)).toEqual(['roots', 'leaves', 'discs', 'hold', 'hold']);
    expect(cameraAt(14.4)).toEqual(cameraAt(15));
  });
  it('36 片叶子错峰，在承托枝结束后开始并于 10 秒前展开', () => {
    const starts = Array.from({ length: 36 }, (_, i) => leafStart(i));
    expect(new Set(starts).size).toBeGreaterThan(10);
    starts.forEach((start, i) => {
      expect(leafProgress(start, i)).toBe(0);
      expect(leafProgress(start + 0.5, i)).toBeGreaterThan(0);
      expect(leafProgress(10, i)).toBe(1);
    });
  });
  it('镜头有限、可重复、关键点左右连续', () => {
    for (let i = 0; i <= DURATION * FPS; i++) {
      const pose = cameraAt(i / FPS);
      expect([...pose.position, ...pose.target, pose.fov].every(Number.isFinite)).toBe(true);
      expect(cameraAt(i / FPS)).toEqual(pose);
    }
    for (const t of [4, 10, 13, 14.4]) {
      const a = cameraAt(t - 0.0001), b = cameraAt(t + 0.0001);
      expect(Math.hypot(...a.position.map((v, i) => v - b.position[i]))).toBeLessThan(0.01);
    }
  });
  it('导出帧不重复终点且帧索引合法', () => {
    expect(frameTime(0)).toBe(0);
    expect(frameTime(359)).toBe(359 / FPS);
    for (const frame of [-1, 360, 1.5, NaN]) expect(() => frameTime(frame)).toThrow();
  });
  it('圆片在叶片展开后由叶柄向叶尖聚合，并于 13 秒全部归位', () => {
    for (let i = 0; i < 36; i++) {
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        expect(discProgress(10, i, v)).toBe(0);
        expect(discProgress(13, i, v)).toBe(1);
        let previous = 0;
        for (let frame = 240; frame <= 312; frame += 6) {
          const p = discProgress(frame / FPS, i, v);
          expect(p).toBeGreaterThanOrEqual(previous); previous = p;
        }
      }
      expect(discProgress(11, i, 0)).toBeGreaterThan(discProgress(11, i, 1));
    }
  });
  it('前半段镜头不变，竖屏镜头独立且有限', () => {
    expect(cameraAt(2).position).toEqual([5.1, 3.9, 10.1]);
    expect(cameraAt(4).position).toEqual([5.6, 5, 12.4]);
    expect(cameraAt(10).position).toEqual([15.2, 11.2, 22.5]);
    expect(cameraAt(13)).toEqual({ position: [8.8, 10.6, 23.8], target: [0, 5.2, 0], fov: 34 });
    expect(cameraAt(15)).toEqual({ position: [10.7, 11.2, 27.5], target: [0, 5.2, 0], fov: 32 });
    expect(cameraAt(10, 'portrait')).not.toEqual(cameraAt(10));
    expect(cameraAt(14.4, 'portrait')).toEqual(cameraAt(15, 'portrait'));
    for (let i = 0; i < 360; i++) {
      const pose = cameraAt(i / FPS, 'portrait');
      expect([...pose.position, ...pose.target, pose.fov].every(Number.isFinite)).toBe(true);
    }
  });
  it('艺术馆版恢复第一版完整树冠机位而不是近景裁切版', () => {
    expect(cameraAt(10, 'portrait')).toEqual({ position: [13, 11.2, 22.5], target: [0, 5.2, 0], fov: 72 });
    expect(cameraAt(13, 'portrait')).toEqual({ position: [8.8, 10.6, 23.8], target: [0, 5.2, 0], fov: 72 });
    expect(cameraAt(15, 'portrait')).toEqual({ position: [10.7, 10.5, 25.3], target: [0, 5.2, 0], fov: 72 });
  });
  it('保留可选近景参数，其开场不变，成树保持近景且末尾不退远', () => {
    expect(cameraAt(0, 'portrait')).toEqual({ position: [3.6, 2.2, 6.4], target: [0, 0.95, 0], fov: 48 });
    expect(cameraAt(4, 'portrait')).toEqual({ position: [4.2, 4.8, 10.5], target: [0, 2.7, 0], fov: 48 });
    // 用树干底部至内冠顶端的中央参考线约束屏幕体量；两侧树冠允许出画。
    for (let frame = 240; frame <= 360; frame++) {
      const pose = cameraAt(frame / FPS, 'portrait', 'close');
      const camera = new PerspectiveCamera(pose.fov, 9 / 16, 0.1, 100);
      camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld();
      const bottom = new Vector3(0, 0.2, 0).project(camera);
      const top = new Vector3(0, 10.5, 0).project(camera);
      const height = (top.y - bottom.y) / 2;
      expect(height).toBeGreaterThanOrEqual(0.6);
      expect(height).toBeLessThanOrEqual(0.85);
      expect(bottom.y).toBeGreaterThan(-0.9);
      expect(top.y).toBeLessThan(0.9);
    }
    const viewSpan = (time: number) => {
      const pose = cameraAt(time, 'portrait', 'close');
      return 2 * Math.hypot(...pose.position.map((v, i) => v - pose.target[i])) * Math.tan(pose.fov * Math.PI / 360);
    };
    expect(viewSpan(14.4)).toBeLessThanOrEqual(viewSpan(13));
    for (const framing of ['complete', 'close'] as const) for (const time of [4, 10, 13, 14.4]) {
      const a = cameraAt(time - 0.0001, 'portrait', framing), b = cameraAt(time + 0.0001, 'portrait', framing);
      expect(Math.hypot(...a.position.map((v, i) => v - b.position[i]))).toBeLessThan(0.01);
      expect(Math.abs(a.fov - b.fov)).toBeLessThan(0.01);
    }
  });
});
