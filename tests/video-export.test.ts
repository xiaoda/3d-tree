import { describe, expect, it } from 'vitest';
import { encoderArgs, validateFrameIndex, validatePng, safeAssetPath, validProbe } from '../scripts/video-export-utils.mjs';
import film from '../app/film.json';
import { DURATION, FPS } from '../app/src/timeline';

describe('本地视频导出边界', () => {
  it('前后端共享 15 秒／360 帧竖屏规格', () => {
    expect(film.duration).toBe(DURATION); expect(film.fps).toBe(FPS);
    expect(film.duration * film.fps).toBe(360); expect(film.width / film.height).toBe(9 / 16);
  });
  it('只接受正确序号，拒绝丢帧、重复和非法索引', () => {
    expect(validateFrameIndex('12', 12, 360)).toBe(12);
    for (const index of ['-1', '1.5', '12x', '012', '360', '11', '13']) expect(() => validateFrameIndex(index, 12, 360)).toThrow();
  });
  it('拒绝路径穿越及 Windows 路径', () => {
    expect(safeAssetPath('/assets/app.js')).toBe('/assets/app.js');
    for (const path of ['/../secret', '/%2e%2e/secret', '/a\\b', '/C:/secret', '/a%00b']) expect(() => safeAssetPath(path)).toThrow();
  });
  it('校验 PNG 签名和尺寸', () => {
    const png = Buffer.alloc(40); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.write('IHDR', 12); png.writeUInt32BE(1080,16); png.writeUInt32BE(1920,20);
    expect(() => validatePng(png,film)).not.toThrow();
    expect(() => validatePng(Buffer.from('no image'),film)).toThrow();
    png.writeUInt32BE(1920,16); expect(() => validatePng(png,film)).toThrow();
  });
  it('编码参数兼容手机，不把路径拼成 shell 命令', () => {
    const args = encoderArgs(film,'D:/导出目录/result.part.mp4');
    expect(args).toContain('libx264'); expect(args).toContain('main'); expect(args).toContain('yuv420p'); expect(args).toContain('+faststart');
    expect(args.at(-1)).toBe('D:/导出目录/result.part.mp4');
  });
  it('只有尺寸、帧率、帧数、编码和时长均匹配才发布成片', () => {
    const result = {streams:[{codec_name:'h264',pix_fmt:'yuv420p',width:1080,height:1920,nb_read_frames:'360',avg_frame_rate:'24/1'}],format:{duration:'15.000'}};
    expect(validProbe(result,film)).toBe(true);
    expect(validProbe({...result,format:{duration:'14.000'}},film)).toBe(false);
    expect(validProbe({...result,streams:[{...result.streams[0],nb_read_frames:'359'}]},film)).toBe(false);
  });
});
