import { TreeStage } from './stage';
import { frameTime } from './timeline';
import film from '../film.json';

const button = document.getElementById('start-export') as HTMLButtonElement;
const message = document.getElementById('message')!;
const progress = document.getElementById('export-progress') as HTMLProgressElement;
const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
const state = { status:'loading', frames:0, total:film.duration*film.fps, error:'', url:'' };
let stage: TreeStage;
progress.max = state.total;

async function request(route: string, method='GET', body?: Blob) {
  const response = await fetch(`/__video/${route}`, {method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'image/png'}:{})},body});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `导出请求失败：${response.status}`);
  return data;
}

function showResult(url: string) {
  document.getElementById('render-frame')!.hidden = true;
  document.getElementById('result')!.hidden = false;
  const video = document.getElementById('result-video') as HTMLVideoElement;
  video.src = url;
  const link = document.getElementById('download-video') as HTMLAnchorElement;
  link.href = url; link.download = film.filename;
}

async function run() {
  if (state.status !== 'ready') throw new Error('导出尚未就绪或已经运行');
  state.status='rendering';button.disabled=true;
  try {
    await request('start','POST');
    stage.setMode('film');stage.setFormat('portrait');stage.setCameraMode('director');
    for (let i=0;i<state.total;i++) {
      if(state.error) throw new Error(state.error);
      stage.seek(frameTime(i));
      const png=stage.captureDataUrl(film.width,film.height);
      const blob=await (await fetch(png)).blob();
      const received=await request(`frame/${i}`,'POST',blob);
      if(received.received!==i+1) throw new Error('帧确认序号不一致');
      state.frames=i+1;progress.value=state.frames;
      if(i%12===0 || i===state.total-1) message.textContent=`正在逐帧渲染：${state.frames} / ${state.total}`;
      // 让预览和进度在长任务中保持响应，时间本身仍由帧索引决定。
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    state.status='encoding';message.textContent='正在完成编码并校验 360 帧…';
    const result=await request('finish','POST');
    state.status='complete';state.url=result.url;
    message.textContent='视频已完成，帧数、时长和编码校验通过。';
    showResult(result.url);
  } catch(error) {
    state.status='failed';state.error=error instanceof Error?error.message:String(error);
    message.textContent=`导出失败：${state.error}\n请检查 logs 中的本任务日志；不会发布未完成的视频。`;
    console.error(error);
  }
}

declare global {
  interface Window { videoExport?: {run:()=>Promise<void>;inspect:()=>typeof state;seek:(time:number)=>void} }
}

requestAnimationFrame(()=>setTimeout(async()=>{
  try {
    stage=new TreeStage(document.getElementById('export-canvas') as HTMLCanvasElement,document.getElementById('render-frame')!,error=>{state.error=error;state.status='failed';message.textContent=error;button.disabled=true;});
    stage.setMode('film');stage.setFormat('portrait');stage.seek(15);
    window.videoExport={run,inspect:()=>({...state}),seek:time=>stage.seek(time)};
    if(!token) {message.textContent='请运行 npm run export:video，在生成的本地导出会话中打开本页。';return;}
    const config=await request('config');
    if(config.duration!==film.duration || config.fps!==film.fps || config.width!==film.width || config.height!==film.height) throw new Error('构建版本与导出规格不一致，请重新构建');
    if(config.status==='complete') {state.status='complete';state.frames=state.total;progress.value=state.total;message.textContent='本次视频已完成。';showResult('/media/'+film.filename);return;}
    if(config.status!=='ready') throw new Error(`导出会话状态为 ${config.status}，不能重复启动`);
    state.status='ready';button.disabled=false;message.textContent='已就绪 · 360 帧 · 全部在本机完成';
    button.addEventListener('click',()=>{void run();});
  } catch(error) {state.status='failed';state.error=error instanceof Error?error.message:String(error);message.textContent=state.error;console.error(error);}
},0));
