import type { Triple } from './config';
import { smoothstep } from './procedural';
import film from '../film.json';

export const DURATION = film.duration;
export const FPS = film.fps;
export type FilmFormat = 'landscape' | 'portrait';
export type StudioMode = 'study' | 'film';
export const PHASES = [
  { id: 'roots', start: 0, end: 4, label: '起笔 · 纤维生根' },
  { id: 'leaves', start: 4, end: 10, label: '舒展 · 枝叶成形' },
  { id: 'discs', start: 10, end: 13, label: '拾光 · 金片聚合' },
  { id: 'hold', start: 13, end: DURATION, label: '成树 · 呼吸停留' },
] as const;

export function normalizeTime(time: number): number {
  if (!Number.isFinite(time)) throw new Error('时间必须是有限数值');
  return Math.min(DURATION, Math.max(0, time));
}

export function progress(time: number, start: number, end: number): number {
  return smoothstep((time - start) / (end - start));
}

export function phaseAt(time: number) {
  const t = normalizeTime(time);
  return PHASES.find(phase => t < phase.end) ?? PHASES[3];
}

// 以方位和层次错峰，而不是同时缩放整棵树。
export function leafStart(index: number): number {
  return 6.1 + (index % 12) * 0.075 + Math.floor(index / 12) * 0.22;
}

export function leafProgress(time: number, index: number): number {
  return progress(time, leafStart(index), leafStart(index) + 2.25);
}

export function discProgress(time: number, leafIndex: number, alongLeaf: number): number {
  const start = 10 + (leafIndex % 7) * 0.12 + alongLeaf * 3.6;
  const retimed = time <= 10 ? time : 10 + (time - 10) * 2;
  return progress(retimed, start, start + 1.2);
}

export function frameTime(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= DURATION * FPS) throw new Error(`帧索引必须在 0–${DURATION * FPS - 1} 之间`);
  return index / FPS;
}

interface CameraPose { position: Triple; target: Triple; fov: number }
const SHOTS: (CameraPose & { time: number })[] = [
  { time: 0, position: [4.6, 2.8, 7.8], target: [0, 0.9, 0], fov: 36 },
  { time: 4, position: [5.6, 5.0, 12.4], target: [0, 2.8, 0], fov: 36 },
  { time: 10, position: [15.2, 11.2, 22.5], target: [0, 5.2, 0], fov: 34 },
  { time: 13, position: [8.8, 10.6, 23.8], target: [0, 5.2, 0], fov: 34 },
  { time: 14.4, position: [10.7, 11.2, 27.5], target: [0, 5.2, 0], fov: 32 },
];

// 竖屏以主体体量为先：允许两侧冠缘出画，不为收全宽冠而退远。
// 开场保持不变；枝叶展开后固定 48° 视场角，低一些的机位保留树干层次。
const PORTRAIT_SHOTS: (CameraPose & { time: number })[] = [
  { time: 0, position: [3.6, 2.2, 6.4], target: [0, 0.95, 0], fov: 48 },
  { time: 4, position: [4.2, 4.8, 10.5], target: [0, 2.7, 0], fov: 48 },
  { time: 10, position: [8.4, 7.6, 14.5], target: [0, 4.8, 0], fov: 48 },
  { time: 13, position: [5.8, 7.3, 15.8], target: [0, 4.8, 0], fov: 48 },
  { time: 14.4, position: [6.4, 7.2, 15.3], target: [0, 4.8, 0], fov: 48 },
];

/** 五次缓动在镜头边界速度、加速度均归零，末尾只保留 0.6 秒镜头停留。 */
export function cameraAt(time: number, format: FilmFormat = 'landscape'): CameraPose {
  const t = normalizeTime(time);
  const shots = format === 'portrait' ? PORTRAIT_SHOTS : SHOTS;
  const last = shots[shots.length - 1];
  if (t >= last.time) return { position: [...last.position], target: [...last.target], fov: last.fov };
  const next = shots.findIndex(shot => shot.time > t), a = shots[next - 1], b = shots[next];
  const x = (t - a.time) / (b.time - a.time);
  const k = x * x * x * (x * (x * 6 - 15) + 10);
  const mix = (from: Triple, to: Triple) => from.map((v, i) => v + (to[i] - v) * k) as Triple;
  return { position: mix(a.position, b.position), target: mix(a.target, b.target), fov: a.fov + (b.fov - a.fov) * k };
}
