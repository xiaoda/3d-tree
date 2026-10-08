import { describe, expect, it } from 'vitest';
import { seededRandom, leafWidth, leafSurface, breathingPose } from '../app/src/procedural';

describe('可重复的造型参数', () => {
  it('相同种子生成相同的序列', () => {
    const a = seededRandom(108), b = seededRandom(108);
    expect(Array.from({ length: 100 }, a)).toEqual(Array.from({ length: 100 }, b));
  });
  it('随机数处于半开区间 [0, 1)', () => {
    const random = seededRandom(9);
    for (let i = 0; i < 10000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
  it.each(['oak', 'lance', 'round'] as const)('%s 叶形两端闭合，中段具有宽度', (kind) => {
    expect(leafWidth(0, kind)).toBeCloseTo(0);
    expect(leafWidth(1, kind)).toBeCloseTo(0);
    expect(leafWidth(0.5, kind)).toBeGreaterThan(0.2);
  });
  it('弯曲叶面只生成有限坐标', () => {
    for (let v = 0; v <= 1; v += 0.05) {
      for (let u = -1; u <= 1; u += 0.1) {
        expect(leafSurface(u, v, 1.4, 3.2, 0.25).every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('呼吸姿态由绝对时间决定，与调用顺序无关', () => {
    const before = breathingPose(2.5, 4);
    breathingPose(300, 4);
    expect(breathingPose(2.5, 4)).toEqual(before);
    expect(Math.abs(before.x)).toBeLessThan(0.03);
    expect(Math.abs(before.z)).toBeLessThan(0.03);
  });
});
