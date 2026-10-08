# 织生 · Woven Life

根据 `photos/` 中实拍艺术装置创作的 Three.js 三维树。当前是 **横屏 16:9 的造型与材质原型**，不是已经完成的生长短片。

当前为第二版：大冠幅、环绕枝叶、双面叶脉和装饰、多色纤维及立体叠层底座。
可查看 [正面静帧](artifacts/woven-life-v2-portrait.png)、[右侧静帧](artifacts/woven-life-v2-side.png)、[背面静帧](artifacts/woven-life-v2-back.png)、[左侧静帧](artifacts/woven-life-v2-left.png)。

## 开发方案

见 [完整开发方案](docs/plans/2026-10-08-woven-tree-development.md)。记录了已确认方向、建模方案、实施顺序、验收标准及后续 20 秒动画计划。

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

- 拖动旋转，滚轮缩放，右键拖动平移。
- **完整树形 / 右侧 / 背面 / 左侧 / 仰视参考 / 纤维细节**：六种镜头预设。
- **呼吸预览**：主动启用轻微叶片运动，再点击暂停；默认静止。
- **参考照片**：查看本地原图副本；不会上传原图。
- **纯净预览**：隐藏界面，按 Escape 返回。
- **导出静帧**：下载 1920 × 1080 PNG，不包含界面文字。实际下载位置由浏览器设置决定。

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
| `app/src/geometry.ts` | 不规则树干、有厚度叶片、曲线几何 |
| `app/src/tree.ts` | 树干、根系、彩色纤维、树结与圆片装配 |
| `app/src/stage.ts` | 灯光、相机、渲染、绝对时间驱动、PNG 导出 |
| `app/src/main.ts` | 预览交互与异常提示 |
| `scripts/dev-server.mjs` | 仅本地的预览服务 |

## 后续逐帧接口

浏览器控制台提供：

```js
window.treeStudio.setView('portrait'); // side / back / left / reference / detail
window.treeStudio.renderAt(3.5);       // 跳转并暂停，单位秒
window.treeStudio.inspect();           // 状态与场景统计
window.treeStudio.capture();           // 1920×1080 PNG data URL
```

时间由绝对值决定，重复调用不会累积误差。当前只有叶片呼吸，**尚未实现线束生长、叶片展开、圆片聚合和 MP4 编码**。

## 已知边界

- 只依据一张照片进行风格化重建；背面与遮挡结构为设计补全，不是扫描模型。
- 线束和叶脉偏雕塑化，后续可根据静帧反馈继续调整密度、树冠体量及手工材质。
- 使用实时光栅化阴影，不等同于离线光线追踪。
- 第二版为 36 片巨型叶片、1216 根／圈线束、11180 个装饰圆片（含正反面）、15 层有厚度的底座。树冠包围盒横向／纵深约 18.65 / 18.72 场景单位。场景较细，低性能设备可能需要后续降级策略。
- Three.js 渲染引擎使主包超过 Vite 默认的 500 kB 提醒阈值；构建可通过，目前未为一次性本地预览额外做拆包。

## 停止服务

先查看 `logs/runtime.json`，核对 PID、任务标记和工作目录，再停止对应 PID。不要全局结束 Node.js 或 Chrome 进程。
