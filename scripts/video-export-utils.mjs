export function validateFrameIndex(value, expected, total) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('帧索引格式无效');
  const index = Number(value);
  if (index !== expected || index >= total) throw new Error(`预期帧 ${expected}，收到 ${index}`);
  return index;
}

export function safeAssetPath(value) {
  const decoded = decodeURIComponent(value);
  if (!decoded.startsWith('/') || /[\\:\x00-\x1f]/.test(decoded) || decoded.split('/').includes('..')) throw new Error('资源路径无效');
  return decoded;
}

export function validatePng(data, spec) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (data.length < 33 || data.length > 12 * 1024 * 1024 || !data.subarray(0,8).equals(signature) || data.toString('ascii',12,16) !== 'IHDR') throw new Error('PNG 内容无效');
  if (data.readUInt32BE(16) !== spec.width || data.readUInt32BE(20) !== spec.height) throw new Error('PNG 尺寸不匹配');
}

export function encoderArgs(spec, output) {
  return ['-hide_banner','-loglevel','warning','-n','-f','image2pipe','-framerate',String(spec.fps),'-vcodec','png','-i','pipe:0',
    '-an','-c:v','libx264','-preset','medium','-crf','20','-profile:v','main','-level:v','4.0',
    '-pix_fmt','yuv420p','-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709,setsar=1',
    '-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
    '-maxrate','8M','-bufsize','16M','-g',String(spec.fps * 2),'-movflags','+faststart',output];
}

export function validProbe(result, spec) {
  const video = result.streams?.find(stream => stream.codec_name === 'h264');
  return Boolean(video && video.width === spec.width && video.height === spec.height && video.pix_fmt === 'yuv420p'
    && Number(video.nb_read_frames) === spec.duration * spec.fps && video.avg_frame_rate === `${spec.fps}/1`
    && Math.abs(Number(result.format?.duration) - spec.duration) < 0.01);
}
