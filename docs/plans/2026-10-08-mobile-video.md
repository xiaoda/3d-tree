# 织生：后半段提速与手机竖屏成片实施计划

> 历史记录：本文的“竖屏收全树冠”构图已根据用户反馈被 [近景构图计划](2026-10-08-mobile-close-framing.md) 替代；15 秒时序与本地导出流程继续沿用。

> 使用 writing-plans 制订、executing-plans 逐项实施；单代理。用户要求保留较满意的前半段、加快后半段，并已选择竖屏 9:16。沿用包含上一批未提交改动的当前工作区，不丢弃或另行提交这些改动。

**目标：** 保持 0–10 秒动作节奏，将后半段压缩一半，交付 15 秒、1080×1920、24 fps、H.264 / yuv420p / faststart 的无声 MP4。

**架构：** 共享影片规格驱动前端与导出服务。时间轴保留前半段，金片从 10–16 秒改为 10–13 秒，收尾改为 13–15 秒。竖屏使用独立镜头而非横屏裁切。独立仅本地导出服务接收有令牌认证、顺序校验、尺寸校验的 PNG 帧，流式送入隐藏 FFmpeg 子进程；完成后校验帧数／编码并输出到本项目 artifacts。

**技术栈：** 现有 TypeScript / Three.js / Vite / Vitest，Node.js 内置 HTTP 与 child_process、本地 FFmpeg / FFprobe、Chrome DevTools MCP。无新增运行时包，无外网上传。

---

## 方案取舍

1. **推荐并实施：只加速后半段。** 前 10 秒不变，后半段 2 倍速；结尾保留约 0.6 秒镜头停留，总长 15 秒。
2. 全片整体加速会损失已认可的前半段，不采用。
3. 保持 20 秒但加新镜头会延长观感和改动范围，不采用。

手机端单独渲染 9:16：前期根部／树干特写，后期拉开保留完整宽树冠。宽冠与窄画幅之间必须保留合理留白，不挤压模型、不剪掉最终树冠。

## 任务 1：节奏与竖屏镜头

- 新增 `app/film.json` 共享规格；修改 `app/src/timeline.ts`、`growth.ts`、`stage.ts`、`main.ts`、`app/index.html`、`style.css`、`tsconfig.json`。
- 先修改 `tests/timeline.test.ts`，要求 duration=15、末帧 359/24、圆片在 13 秒完成、14.4 秒开始镜头停留，验证预期失败。
- 保留 0–10 秒所有动作与横屏镜头采样不变；竖屏独立取景，提供手机构图预览。
- 所有面板时间、进度条、分镜按钮、帧范围从共享规格更新，禁止遗留 20 秒上限。
- `npm test`、`npm run build`，真实浏览器检查 0、4、7、10、11.5、13、15 秒竖屏构图与控制台。

## 任务 2：可复现视频输出

- 新增 `scripts/video-export-server.mjs`、`scripts/video-export-utils.mjs`、`scripts/start-video-export.ps1`、`app/export.html`、`app/src/export-video.ts`；更新 Vite 多入口和 package scripts。
- 导出服务仅监听 127.0.0.1、随机端口；不开放目录列表；只能提供 dist 下构建文件和当前导出的固定视频文件。
- 写请求要求每次任务随机令牌、同源请求、限定路径／帧索引、PNG 签名与尺寸、体积上限；不接收任意命令或文件路径。
- `spawn('ffmpeg', args, { windowsHide: true, shell: false })`，标准输出／错误入任务日志，记录 Node / FFmpeg PID、工作目录、端口；逐帧背压处理，不用实时录屏、不跳帧。
- 临时视频完成且 FFprobe 验证 360 帧、15 秒、正确尺寸和编码后才重命名为正式文件；失败保留日志但不冒充成片。
- `tests/video-export.test.ts` 覆盖路径／索引／PNG／编码参数及共享规格一致性。

## 任务 3：视频验收与交付

- Chrome DevTools MCP 先 list_pages，再新建任务独立页面。按 `t = index / 24` 输出 360 帧。
- FFprobe 验证时长、帧数、宽高、帧率、像素格式、编码；FFmpeg 完整解码检查，确认 moov 位于 mdat 之前。
- 从最终 MP4 抽取起始、生长、聚合、收尾帧，使用 view_image 查看；检查画面未挤压、树冠未裁切、后半段动作完成。
- 在移动视口 HTML video 中检查加载、播放、seek 与 ended。明确这是浏览器仿真，不能声称已经覆盖用户实际手机。
- 更新 README、验收记录，交付本地视频路径与可打开的本地预览／下载页。不自动提交、推送或公网发布。

格式依据：[Android 支持的媒体格式](https://developer.android.com/media/platform/supported-formats)；[FFmpeg MP4 faststart](https://ffmpeg.org/ffmpeg-formats.html#mov_002c-mp4_002c-ismv)。不宣称所有旧机型都支持 1080p。
