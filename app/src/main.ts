import './style.css';
import { TreeStage } from './stage';
import { VIEWS, type ViewName } from './config';
import { DURATION, FPS, PHASES, frameTime, phaseAt, type StudioMode, type FilmFormat } from './timeline';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = element('status');
const errorMessage = (message: string) => {
  element('loading').hidden = true;
  element('error').hidden = false;
  element('error-message').textContent = message;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.toolbar button, .film-panel button, .film-panel input').forEach(control => { control.disabled = true; });
  status.textContent = '渲染未完成，请查看画面中的错误提示。';
};
element('reload-button').addEventListener('click', () => location.reload());

const reference = element<HTMLDialogElement>('reference-dialog');
element('reference-button').addEventListener('click', () => reference.showModal());
element('close-reference').addEventListener('click', () => reference.close());
reference.addEventListener('click', event => { if (event.target === reference) reference.close(); });

function setClean(clean: boolean) {
  document.body.classList.toggle('clean', clean);
  element('exit-clean').hidden = !clean;
  if (clean) element('exit-clean').focus(); else element('clean-button').focus();
}
element('clean-button').addEventListener('click', () => setClean(true));
element('exit-clean').addEventListener('click', () => setClean(false));
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('clean')) setClean(false);
});

declare global {
  interface Window {
    treeStudio?: {
      renderAt: (time: number) => void;
      setView: (name: ViewName) => void;
      setMode: (mode: StudioMode) => void;
      setFormat: (format: FilmFormat) => void;
      setCameraMode: (mode: 'director' | 'free') => void;
      renderFrame: (index: number) => void;
      play: () => void;
      pause: () => void;
      inspect: () => ReturnType<TreeStage['inspect']>;
      capture: (width?: number, height?: number) => string;
      leafPoses: () => number[][];
    };
  }
}

// 先让加载提示进入一帧，再同步生成可重复模型。
requestAnimationFrame(() => setTimeout(() => {
  try {
    const stage = new TreeStage(element<HTMLCanvasElement>('scene'), document.querySelector<HTMLElement>('.viewport')!, errorMessage);
    const playButton = element<HTMLButtonElement>('play-button');
    const timeline = element<HTMLInputElement>('timeline');
    timeline.max = String(DURATION); timeline.step = String(1 / FPS);
    let lastStatus = '';
    function syncUI() {
      const film = stage.mode === 'film', director = film && stage.cameraMode === 'director';
      const phase = phaseAt(stage.time);
      element('timeline-controls').hidden = !film;
      document.body.classList.toggle('film-mode', film);
      document.body.classList.toggle('portrait-film', film && stage.format === 'portrait');
      element('format-button').textContent = stage.format === 'portrait' ? '画幅 · 手机竖屏' : '画幅 · 横屏';
      element('format-button').setAttribute('aria-pressed', String(stage.format === 'portrait'));
      document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
        const selected = button.dataset.mode === stage.mode;
        button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
      });
      document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
        const selected = !director && button.dataset.view === stage.view;
        button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
      });
      document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((button, index) => {
        const selected = PHASES[index].id === phase.id;
        const chapter = PHASES[index];
        button.dataset.time = String(chapter.start);
        button.querySelector('span')!.textContent = `${String(index + 1).padStart(2, '0')} / ${String(chapter.start).padStart(2, '0')}–${String(chapter.end).padStart(2, '0')}″`;
        button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
      });
      element('format-label').textContent = film && stage.format === 'portrait' ? '9 : 16' : '16 : 9';
      timeline.value = String(Math.min(DURATION, stage.time));
      timeline.setAttribute('aria-valuetext', `${stage.time.toFixed(2)} 秒，共 ${DURATION} 秒，${phase.label}`);
      timeline.style.setProperty('--progress', `${Math.min(100, stage.time / DURATION * 100)}%`);
      element('time-readout').textContent = `${Math.min(DURATION, stage.time).toFixed(2).padStart(5, '0')} / ${DURATION.toFixed(2)}`;
      element('film-caption').textContent = film ? `${phase.label} · 24 fps 时间刻度` : '造型已定稿 · 点击「生长短片」开始';
      element('study-label').textContent = film ? 'GROWTH STUDY' : 'MATERIAL STUDY';
      element('scene').setAttribute('aria-label', director ? '三维生长动画，导演镜头由时间轴控制' : '三维艺术树，可拖动旋转、滚轮缩放');
      playButton.setAttribute('aria-pressed', String(stage.playing));
      element('play-icon').textContent = stage.playing ? 'Ⅱ' : '▷';
      element('play-label').textContent = stage.playing ? '暂停播放' : film ? (stage.time >= DURATION ? '重新播放' : '播放短片') : '呼吸预览';
      element('director-button').setAttribute('aria-pressed', String(director));
      element('director-button').textContent = director ? '导演镜头 · 开' : '导演镜头 · 关';
      element('view-label').textContent = director ? phase.label : VIEWS[stage.view].label;
      element('camera-hint').textContent = director ? '导演镜头 · 随时间轴运镜' : '拖动旋转 · 滚轮缩放';
      element<HTMLButtonElement>('previous-frame').disabled = stage.time <= 0;
      element<HTMLButtonElement>('next-frame').disabled = stage.time >= DURATION;
      const summary = film ? `${stage.playing ? '正在播放' : stage.time >= DURATION ? '播放结束' : '已暂停'} · ${phase.label} · 动画预览版` : '造型研究 · 完整第二版模型';
      if (lastStatus !== summary) { status.textContent = summary; lastStatus = summary; }
    }
    stage.onStateChange = syncUI;
    function selectView(name: ViewName) {
      stage.setView(name);
    }
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
      button.addEventListener('click', () => selectView(button.dataset.view as ViewName));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
      button.addEventListener('click', () => stage.setMode(button.dataset.mode as StudioMode));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(button => {
      button.addEventListener('click', () => stage.seek(Number(button.dataset.time)));
    });
    timeline.addEventListener('input', () => stage.seek(Math.min(DURATION, Math.round(Number(timeline.value) * FPS) / FPS)));
    playButton.addEventListener('click', () => stage.togglePlay());
    element('restart-button').addEventListener('click', () => stage.restart());
    element('previous-frame').addEventListener('click', () => stage.stepFrame(-1));
    element('next-frame').addEventListener('click', () => stage.stepFrame(1));
    element('director-button').addEventListener('click', () => stage.setCameraMode(stage.cameraMode === 'director' ? 'free' : 'director'));
    element('format-button').addEventListener('click', () => { stage.setCameraMode('director'); stage.setFormat(stage.format === 'portrait' ? 'landscape' : 'portrait'); });
    const exportButton = element<HTMLButtonElement>('export-button');
    exportButton.addEventListener('click', () => {
      exportButton.disabled = true;
      status.textContent = '正在渲染当前画幅的高清静帧…';
      requestAnimationFrame(() => setTimeout(() => {
        try {
          const portrait = stage.mode === 'film' && stage.format === 'portrait';
          const data = stage.captureDataUrl(portrait ? 1080 : 1920, portrait ? 1920 : 1080);
          const link = document.createElement('a');
          link.href = data; link.download = `织生-${stage.mode === 'film' ? `${stage.time.toFixed(2)}秒` : VIEWS[stage.view].label}-${portrait ? '1080x1920' : '1920x1080'}.png`;
          document.body.append(link); link.click(); link.remove();
          status.textContent = `已生成 PNG 静帧 · ${portrait ? '1080 × 1920' : '1920 × 1080'} · 不含界面文字`;
        } catch (error) {
          status.textContent = `静帧导出失败：${error instanceof Error ? error.message : String(error)}`;
        } finally { exportButton.disabled = false; }
      }, 0));
    });
    stage.renderAt(0);
    element('loading').hidden = true;
    window.treeStudio = {
      renderAt: time => stage.seek(time),
      renderFrame: index => { const time = frameTime(index); stage.setMode('film'); stage.setCameraMode('director'); stage.seek(time); },
      setView: selectView,
      setMode: mode => stage.setMode(mode),
      setFormat: format => stage.setFormat(format),
      setCameraMode: mode => stage.setCameraMode(mode),
      play: () => { if (!stage.playing) stage.togglePlay(); },
      pause: () => { if (stage.playing) stage.togglePlay(); },
      inspect: () => stage.inspect(),
      capture: (width, height) => stage.captureDataUrl(width, height),
      leafPoses: () => stage.tree.leaves.map(leaf => leaf.quaternion.toArray()),
    };
    syncUI();
    if (import.meta.hot) import.meta.hot.dispose(() => stage.dispose());
  } catch (error) {
    console.error(error);
    errorMessage(error instanceof Error ? error.message : '初始化失败，请确认浏览器支持 WebGL 2。');
  }
}, 0));
