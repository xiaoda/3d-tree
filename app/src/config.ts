import type { LeafKind } from './procedural';
export type Triple = [number, number, number];
export type ViewName = 'portrait' | 'side' | 'back' | 'left' | 'reference' | 'detail';
export interface LeafSpec {
  base: Triple;
  tip: Triple;
  width: number;
  kind: LeafKind;
  color: string;
  vein: string;
  roll: number;
  curl: number;
  facing: Triple;
  confetti?: boolean;
}

export const SEED = 81026;
export const PALETTE = {
  bark: '#6a4938',
  fibers: ['#664336', '#c48a57', '#e2b34b', '#f0cc79', '#d5b69b', '#c58f9e', '#a08aac', '#c2b2d0', '#708d9b', '#87ada5', '#a6ad79', '#6e754f', '#e3d3b8', '#92606b', '#714856', '#b07863'],
  discs: ['#f6cc43', '#e7af24', '#f6de79', '#cc8c26', '#ecba34', '#eee0a0', '#b57732'],
};

const leafStyles: Pick<LeafSpec, 'kind' | 'color' | 'vein' | 'confetti'>[] = [
  { kind: 'oak', color: '#dcb142', vein: '#b98641', confetti: true },
  { kind: 'oak', color: '#dba848', vein: '#ac713e' },
  { kind: 'lance', color: '#7e9474', vein: '#dad5a5' },
  { kind: 'oak', color: '#c38b58', vein: '#e6bd88' },
  { kind: 'round', color: '#967d9d', vein: '#d3bdc1' },
  { kind: 'lance', color: '#bf8586', vein: '#e7c6a9' },
  { kind: 'oak', color: '#d6c78c', vein: '#a78651' },
  { kind: 'oak', color: '#668779', vein: '#c8cba0' },
  { kind: 'lance', color: '#a9b79b', vein: '#e8ddba' },
  { kind: 'oak', color: '#a9ac70', vein: '#d8c28b', confetti: true },
];

function radialLeaf(angle: number, baseRadius: number, tipRadius: number, baseY: number, tipY: number, width: number, style: number, roll: number, outer = false): LeafSpec {
  const a = angle * Math.PI / 180;
  const sweep = Math.sin(a * 3 + baseY) * 0.16;
  return {
    base: [Math.cos(a - sweep) * baseRadius, baseY, Math.sin(a - sweep) * baseRadius],
    tip: [Math.cos(a) * tipRadius, tipY, Math.sin(a) * tipRadius],
    width, ...leafStyles[style % leafStyles.length], roll,
    curl: outer ? 0.55 : 0.38,
    facing: outer ? [-Math.sin(a) * 0.65, 1, Math.cos(a) * 0.65] : [Math.cos(a), 0.12, Math.sin(a)],
  };
}

// 三层空间布局：外展大叶、抬升大叶、内冠。参数逐片安排，而非复制正面模型。
export const LEAVES: LeafSpec[] = [
  ...[3, 34, 64, 97, 123, 156, 184, 217, 248, 275, 308, 336].map((a, i) =>
    radialLeaf(a, 1.5 + (i % 3) * 0.3, 8.9 + [0.3, -0.15, 0.5, 0][i % 4], 6.6 + (i % 3) * 0.27, 7.0 + [0.6, -0.2, 0.4, 0.9][i % 4], 1.85 + (i % 3) * 0.14, [3, 6, 0, 8, 5, 1, 7, 0, 4, 6, 9, 1][i], [-0.22, 0.25, -0.05, 0.36][i % 4], true)),
  ...[18, 53, 84, 112, 146, 174, 204, 238, 266, 297, 326, 352].map((a, i) =>
    radialLeaf(a, 0.85 + (i % 3) * 0.2, 5.9 + (i % 3) * 0.32, 5.55 + (i % 4) * 0.17, 9.0 + [0.45, -0.25, 0.15][i % 3], 1.45 + (i % 3) * 0.13, [7, 1, 6, 0, 4, 2, 3, 9, 1, 5, 8, 0][i], [-0.13, 0.26, -0.24][i % 3])),
  ...[9, 62, 114, 167, 217, 271, 321].map((a, i) =>
    radialLeaf(a, 0.5, 3.7 + (i % 2) * 0.3, 6.75 + (i % 2) * 0.16, 10.15 + [0, 0.4, 0.15][i % 3], 1.27 + (i % 2) * 0.2, [2, 3, 7, 1, 6, 4, 8][i], (i % 2 ? 0.18 : -0.12))),
  ...[42, 117, 187, 259, 329].map((a, i) =>
    radialLeaf(a, 3.7 + (i % 2) * 0.35, 4.8 + (i % 2) * 0.3, 8.2 + (i % 2) * 0.35, 5.5 + (i % 3) * 0.35, 1.27 + (i % 2) * 0.16, [0, 9, 5, 0, 4][i], (i % 2 ? 0.16 : -0.16))),
];

export const VIEWS: Record<ViewName, { position: Triple; target: Triple; fov: number; label: string }> = {
  portrait: { position: [10.7, 10.5, 23.5], target: [0, 5.2, 0], fov: 32, label: '完整树形' },
  side: { position: [25.8, 10.5, -1.5], target: [0, 5.2, 0], fov: 32, label: '侧面树冠' },
  back: { position: [-10.7, 10.5, -23.5], target: [0, 5.2, 0], fov: 32, label: '背面树冠' },
  left: { position: [-25.8, 10.5, 1.5], target: [0, 5.2, 0], fov: 32, label: '左侧树冠' },
  reference: { position: [6.3, 3.1, 13.8], target: [0, 5.65, 0], fov: 60, label: '仰视参考' },
  detail: { position: [4.0, 3.8, 7.8], target: [-0.2, 3.35, 0.25], fov: 30, label: '纤维细节' },
};
