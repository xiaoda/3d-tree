import './style.css';
import { TreeStage } from './stage';
import { VIEWS, type ViewName } from './config';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = element('status');
const errorMessage = (message: string) => {
  element('loading').hidden = true;
  element('error').hidden = false;
  element('error-message').textContent = message;
  document.querySelectorAll<HTMLButtonElement>('.toolbar button').forEach(button => { button.disabled = true; });
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
    function selectView(name: ViewName) {
      stage.setView(name);
      document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
        const selected = button.dataset.view === name;
        button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
      });
      element('view-label').textContent = VIEWS[name].label;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
      button.addEventListener('click', () => selectView(button.dataset.view as ViewName));
    });
    const playButton = element<HTMLButtonElement>('play-button');
    playButton.addEventListener('click', () => {
      const playing = stage.togglePlay();
      playButton.setAttribute('aria-pressed', String(playing));
      element('play-icon').textContent = playing ? 'Ⅱ' : '▷';
      element('play-label').textContent = playing ? '暂停呼吸' : '呼吸预览';
      status.textContent = playing ? '轻微叶片呼吸预览 · 非完整生长动画' : '已暂停 · 可旋转检查造型与材质';
    });
    const exportButton = element<HTMLButtonElement>('export-button');
    exportButton.addEventListener('click', () => {
      exportButton.disabled = true;
      status.textContent = '正在渲染 1920 × 1080 静帧…';
      requestAnimationFrame(() => setTimeout(() => {
        try {
          const data = stage.captureDataUrl();
          const link = document.createElement('a');
          link.href = data; link.download = `织生-${VIEWS[stage.view].label}-1920x1080.png`;
          document.body.append(link); link.click(); link.remove();
          status.textContent = '已生成 PNG 静帧 · 1920 × 1080 · 不含界面文字';
        } catch (error) {
          status.textContent = `静帧导出失败：${error instanceof Error ? error.message : String(error)}`;
        } finally { exportButton.disabled = false; }
      }, 0));
    });
    stage.renderAt(0);
    element('loading').hidden = true;
    window.treeStudio = {
      renderAt: time => { stage.playing = false; playButton.setAttribute('aria-pressed', 'false'); element('play-label').textContent = '呼吸预览'; element('play-icon').textContent = '▷'; stage.renderAt(time); },
      setView: selectView,
      inspect: () => stage.inspect(),
      capture: (width, height) => stage.captureDataUrl(width, height),
      leafPoses: () => stage.tree.leaves.map(leaf => leaf.quaternion.toArray()),
    };
    if (import.meta.hot) import.meta.hot.dispose(() => stage.dispose());
  } catch (error) {
    console.error(error);
    errorMessage(error instanceof Error ? error.message : '初始化失败，请确认浏览器支持 WebGL 2。');
  }
}, 0));
