# 织生 · Woven Life

根据 `photos/` 中实拍艺术装置创作的 Three.js 三维树。当前为 **15 秒生长短片**，支持横屏研究与手机竖屏预览，已输出 **9:16、1080×1920 的手机 MP4**。

本机成片：[织生 · 手机竖屏近景版](artifacts/woven-life-mobile-close-15s-1080x1920.mp4)（无声）。成树保持近景体量，允许两侧树冠出画，结尾不再拉远。`artifacts/` 不提交 Git；文件只在生成它的本机存在。旧版完整树冠视频保留用于对比。

造型沿用已确认的第二版：大冠幅、环绕枝叶、双面叶脉和装饰、多色纤维及立体叠层底座。第三阶段新增分部件生长、圆片聚合、导演镜头与时间轴。
可查看 [正面静帧](artifacts/woven-life-v2-portrait.png)、[右侧静帧](artifacts/woven-life-v2-side.png)、[背面静帧](artifacts/woven-life-v2-back.png)、[左侧静帧](artifacts/woven-life-v2-left.png)。

## 开发方案

见 [完整开发方案](docs/plans/2026-10-08-woven-tree-development.md)。记录了已确认方向、建模方案、实施顺序、验收标准及后续 20 秒动画计划。

本阶段见 [生长动画实施计划](docs/plans/2026-10-08-growth-animation.md) 和 [动画预览验证记录](docs/verification/2026-10-08-growth-preview.md)。

导出功能见 [手机成片实施计划](docs/plans/2026-10-08-mobile-video.md) 与 [首版手机视频验收](docs/verification/2026-10-08-mobile-video.md)。最新构图调整见 [竖屏近景计划](docs/plans/2026-10-08-mobile-close-framing.md) 与 [近景版验收](docs/verification/2026-10-08-mobile-close-framing.md)。旧版 20 秒记录及完整树冠竖屏构图均为历史，不再代表当前成片。

## 启动本地预览

依赖已通过 `package-lock.json` 锁定。本次使用 Node.js 24。

```powershell
npm ci
npm run dev
```

服务仅监听 `127.0.0.1`，每次使用系统分配的空闲端口，实际地址会输出到终端并写入 `logs/runtime.json`。不要假定端口固定不变。

Windows 推荐后台启动：

```powershell
powershell -NoProfile -File scripts/start-preview.ps1
```

该脚本复用已确认归属的本项目服务；新建进程使用隐藏窗口，输出和错误写入 `logs/preview-时间戳.stdout.log`、`logs/preview-时间戳.stderr.log`。不修改执行策略、注册表或全局终端配置。

## 使用

- 默认进入**造型研究**，显示完整第二版模型且不自动播放。自由镜头下可拖动旋转，滚轮缩放，右键拖动平移。
- 点击**生长短片**进入 15 秒动画，再点击**播放短片**。播放到末尾自动暂停；从头播放可重播。
- 四个分镜入口可直接跳到 **0 / 4 / 10 / 13 秒**；拖动时间轴或使用方向键以 1/24 秒定位，上一帧／下一帧均会暂停。
- **画幅**切换横屏或手机竖屏，同时恢复相应导演镜头。竖屏是独立取景，不是横屏裁切／拉伸。
- **导演镜头**自动随时间运镜；关闭后可自由观察动画。选择任一预设镜头也会关闭导演镜头，不重置动画时间。
- **完整树形 / 右侧 / 背面 / 左侧 / 仰视参考 / 纤维细节**：六种镜头预设。
- **呼吸预览**：造型研究中的轻微叶片运动；生长短片中则播放完整时间轴。所有运动都由用户主动启用。
- **参考照片**：查看本地原图副本；不会上传原图。
- **纯净预览**：隐藏界面，按 Escape 返回。
- **导出静帧**：横屏下载 1920×1080 PNG，手机竖屏下载 1080×1920 PNG，不包含界面文字。实际下载位置由浏览器设置决定。

## 检查

```powershell
npm test
npm run build
```

`dist/` 为生产构建。本地开发界面不使用外部 CDN、网络字体或第三方图片服务。

## 主要文件

| 文件 | 用途 |
| --- | --- |
| `app/src/config.ts` | 叶片布置、配色、镜头参数 |
| `app/src/procedural.ts` | 有种子随机、叶形与呼吸参数 |
| `app/film.json` | 前端与导出服务共享的时长、帧率、竖屏规格 |
| `app/src/timeline.ts` | 15 秒分镜、错峰进度、横竖屏导演镜头、24 fps 帧定位 |
| `app/src/growth.ts` | 纤维出生时间、同步阴影、生长截面、圆片聚合 |
| `app/src/geometry.ts` | 不规则树干、有厚度叶片、曲线几何 |
| `app/src/tree.ts` | 树干、根系、彩色纤维、树结与圆片装配 |
| `app/src/stage.ts` | 灯光、相机、渲染、绝对时间驱动、PNG 导出 |
| `app/src/main.ts` | 预览交互与异常提示 |
| `scripts/dev-server.mjs` | 仅本地的预览服务 |
| `app/export.html`、`app/src/export-video.ts` | 逐帧渲染与成片播放／下载界面 |
| `scripts/video-export-server.mjs` | 本地认证帧接收、隐藏 FFmpeg 编码与 FFprobe 验证 |

## 动画分镜

| 时间 | 内容 |
| --- | --- |
| 0–4 秒 | 根部纤维汇入，树干线束向上延伸 |
| 4–10 秒 | 主枝与承托枝成形，36 片叶子错峰舒展 |
| 10–13 秒 | 正反面圆片由叶柄向叶尖逐行聚合，相比原版快 1 倍 |
| 13–15 秒 | 竖屏保持近景并略微靠近，横屏保留原收尾；轻微呼吸，最后 0.6 秒镜头停留 |

前 10 秒生长时序不变。竖屏 0–4 秒根部／树干近景保持原样，4–10 秒随生长平滑转入较近中景。成树阶段优先呈现树干与枝叶细节，允许两侧树冠出画，不为收全宽冠而退远；末尾不再缩小主体。使用独立相机重新渲染，不拉伸模型，也不放大旧视频像素。默认造型研究与横屏镜头不变。

## 逐帧接口

浏览器控制台提供：

```js
window.treeStudio.setMode('film');     // study 为完整静态造型研究
window.treeStudio.setFormat('portrait'); // 或 landscape，配合相应画幅预览
window.treeStudio.renderAt(3.5);       // 自动切入动画、跳转并暂停，保留当前镜头模式
window.treeStudio.setCameraMode('director'); // 或 free
window.treeStudio.setView('portrait'); // 自动转为自由镜头；也有 side/back/left/reference/detail
window.treeStudio.renderFrame(240);    // 0–359，强制导演镜头，t = index / 24
window.treeStudio.play();              // 末尾时从 0 重播
window.treeStudio.pause();
window.treeStudio.inspect();           // 模式、时间、分镜、镜头与场景统计
window.treeStudio.capture();           // 当前画面的 1920×1080 PNG data URL
window.treeStudio.capture(1080, 1920); // 竖屏 PNG；先 setFormat('portrait')
```

时间由绝对值决定，重复调用不会累积误差。`renderAt` 的有限时间夹取到 0–15 秒；`renderFrame` 拒绝非整数或范围外索引。正式输出逐帧调用 `renderFrame(0..359)` 再捕获，每帧共用同一场景，不使用实时录屏代替确定性输出。

## 重新生成手机视频

需要本机 Node.js 24、FFmpeg 和 FFprobe 可从 PATH 调用。

```powershell
npm run build
npm run export:video
```

脚本隐藏启动仅监听 `127.0.0.1` 的独立导出服务，并记录真实端口、PID、目录与日志。一次性会话保存在被 Git 忽略的 `video-export-session.local`，不要提交或分享该文件。

在本机浏览器打开该文件中 `url` 对应地址，附加 `/export.html#token=` 和该文件中的 `token`，点击“生成手机 MP4”。导出页面使用 360 个确定时间帧，依次送入无窗口 FFmpeg；编码成功且参数验证通过后才发布最终 MP4，可在页面播放和下载。

每次新任务写入 `artifacts/mobile-video-时间戳/`，不覆盖既有视频。最终编码为 H.264 Main / Level 4.0、yuv420p、24 fps、15 秒、faststart，无音轨。成片可以传到手机相册／文件应用播放，无须手机运行 Three.js。`127.0.0.1` 仅属于当前电脑，不是手机访问地址。

## 已知边界

- 只依据一张照片进行风格化重建；背面与遮挡结构为设计补全，不是扫描模型。
- 线束和叶脉偏雕塑化，后续可根据静帧反馈继续调整密度、树冠体量及手工材质。
- 使用实时光栅化阴影，不等同于离线光线追踪。
- 生长使用沿曲线显露与移动实体截面，叶片以叶柄为支点缩展／转动，不是绳线物理或植物生理模拟；极近距离仍可见纤维显露端的小截口。
- 聚合窗口内更新圆片实例矩阵，窗口外不重复上传；最终恢复原始矩阵。低性能设备的播放流畅度仍需实测，不承诺实时 4K。
- 第二版为 36 片巨型叶片、1216 根／圈线束、11180 个装饰圆片（含正反面）、15 层有厚度的底座。树冠包围盒横向／纵深约 18.65 / 18.72 场景单位。场景较细，低性能设备可能需要后续降级策略。
- Three.js 渲染引擎使主包超过 Vite 默认的 500 kB 提醒阈值；构建可通过，目前未为一次性本地预览额外做拆包。
- 已做视频格式、完整解码和移动视口浏览器验证，未在用户真实手机上测试；不保证所有旧机型的 1080p 解码性能。

## 停止服务

先查看 `logs/runtime.json`，核对 PID、任务标记和工作目录，再停止对应 PID。不要全局结束 Node.js 或 Chrome 进程。

独立视频服务对应 `logs/video-export-runtime.json`；同样只停止核实归属的本任务 PID。FFmpeg 在编码完成后自行退出；中断渲染超过五分钟会停止本任务编码并记录失败，不发布半成品。
