export type LeafKind = 'oak' | 'lance' | 'round';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function leafWidth(t: number, kind: LeafKind): number {
  if (t <= 0 || t >= 1) return 0;
  const envelope = Math.sin(Math.PI * t);
  if (kind === 'lance') return Math.pow(envelope, 0.95) * (0.8 + 0.2 * t);
  if (kind === 'round') return Math.pow(envelope, 0.56) * (1 - 0.18 * t);
  return Math.pow(envelope, 0.62) * (0.76 + 0.24 * Math.cos((t - 0.08) * Math.PI * 8));
}

/** u 是相对叶片宽度，v 是相对长度；叶片法线大致指向 +Z。 */
export function leafSurface(u: number, v: number, halfWidth: number, length: number, curl: number): [number, number, number] {
  return [u * halfWidth, v * length,
    curl * Math.sin(v * Math.PI * 0.85) + 0.13 * u * u * Math.sin(v * Math.PI) + 0.08 * u * Math.sin(v * Math.PI * 1.7)];
}

/** 用绝对时间计算，避免暂停／跳转／离线逐帧输出时累积误差。 */
export function breathingPose(time: number, index: number) {
  return {
    x: Math.sin(time * 0.48 + index * 1.17) * 0.014,
    z: Math.sin(time * 0.37 + index * 0.79) * 0.011,
  };
}

export function smoothstep(value: number): number {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
}
