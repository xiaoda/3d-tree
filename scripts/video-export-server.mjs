import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, openSync, closeSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile, stat, rename } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { encoderArgs, safeAssetPath, validateFrameIndex, validatePng, validProbe } from './video-export-utils.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const spec = JSON.parse(await readFile(path.join(cwd,'app/film.json'),'utf8'));
const runId = randomUUID();
const token = randomBytes(32).toString('hex');
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const logs = path.join(cwd,'logs');
const outputDir = path.join(cwd,'artifacts',`mobile-video-${stamp}`);
await mkdir(logs,{recursive:true}); await mkdir(outputDir,{recursive:true});
const output = path.join(outputDir,spec.filename);
const temporary = path.join(outputDir,'encoding.part.mp4');
const assets = new Map();
const dist = path.join(cwd,'dist');
async function inventory(folder, prefix='') {
  for (const item of await readdir(folder,{withFileTypes:true})) {
    if (item.isSymbolicLink()) continue;
    const relative = `${prefix}/${item.name}`;
    if (item.isDirectory()) await inventory(path.join(folder,item.name),relative);
    else if (item.isFile()) assets.set(relative,path.join(folder,item.name));
  }
}
await inventory(dist);
if (!assets.has('/export.html')) throw new Error('请先运行 npm run build，生成导出页面');
// 启动前检查工具；不在后台无声失败。
const runFile = promisify(execFile);
await runFile('ffmpeg',['-version'],{windowsHide:true});
await runFile('ffprobe',['-version'],{windowsHide:true});
const state = { task:'woven-mobile-video', runId, pid:process.pid, cwd, startedAt:new Date().toISOString(), port:0, url:'', status:'ready', frames:0, total:spec.duration*spec.fps, output, ffmpegPid:null, error:null };
let encoder, completion, busy=false;
let lastActivity=Date.now();
const statePath = path.join(logs,'video-export-runtime.json');
async function saveState() { await writeFile(statePath,JSON.stringify(state,null,2)); }
function respond(response, code, data) {
  response.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  response.end(JSON.stringify(data));
}
function authenticated(request) {
  const value = request.headers.authorization ?? '';
  const expected = `Bearer ${token}`;
  return value.length === expected.length && timingSafeEqual(Buffer.from(value),Buffer.from(expected));
}
async function bodyOf(request) {
  let size=0; const chunks=[];
  for await (const chunk of request) {
    size+=chunk.length;
    if(size>12*1024*1024) throw new Error('单帧超过体积上限');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function sendFile(request,response,file,mime) {
  const {size}=await stat(file);
  let start=0,end=size-1,code=200;
  if(request.headers.range) {
    const match=/^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
    if(!match) {response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return;}
    start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;
    if(start>end || start>=size) {response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return;}
    code=206;response.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
  }
  response.writeHead(code,{'Content-Type':mime,'Accept-Ranges':'bytes','Content-Length':end-start+1,'Cache-Control':'no-store'});
  if(request.method==='HEAD') {response.end();return;}
  const stream=createReadStream(file,{start,end});stream.on('error',()=>response.destroy());stream.pipe(response);
}

const server=http.createServer(async(request,response)=>{
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy','same-origin');
  if(request.headers.host!==`127.0.0.1:${state.port}`) return respond(response,403,{error:'Host 不匹配'});
  if(request.headers.origin && request.headers.origin!==state.url) return respond(response,403,{error:'不允许跨源请求'});
  let authorizedWrite=false;
  try {
    const route=safeAssetPath((request.url ?? '/').split('?')[0]);
    if(route==='/__video/health' && request.method==='GET') return respond(response,200,{task:state.task,runId,pid:process.pid,status:state.status});
    if(route.startsWith('/__video/')) {
      if(!authenticated(request)) return respond(response,401,{error:'导出令牌无效'});
      if(route==='/__video/config' && request.method==='GET') return respond(response,200,{...spec,total:state.total,status:state.status});
      if(request.method!=='POST' || request.headers.origin!==state.url) return respond(response,403,{error:'只允许同源 POST'});
      authorizedWrite=true;lastActivity=Date.now();
      if(busy) return respond(response,409,{error:'前一帧尚未完成'});
      busy=true;
      try {
        if(route==='/__video/start') {
          if(state.status!=='ready') return respond(response,409,{error:'本任务已经开始，请勿重复导出'});
          const fd=openSync(path.join(logs,`video-ffmpeg-${runId}.log`),'a');
          try { encoder=spawn('ffmpeg',encoderArgs(spec,temporary),{cwd,windowsHide:true,shell:false,stdio:['pipe',fd,fd]}); }
          finally {closeSync(fd);}
          encoder.stdin.on('error',error=>{state.error=error.message;});
          completion=new Promise(resolve=>{
            encoder.once('error',error=>resolve({code:-1,error:error.message}));
            encoder.once('close',code=>resolve({code}));
          });
          state.ffmpegPid=encoder.pid ?? null;state.status='rendering';await saveState();
          console.log(JSON.stringify({event:'encoder-start',pid:state.ffmpegPid,cwd,output}));
          return respond(response,200,{ok:true});
        }
        if(route.startsWith('/__video/frame/')) {
          if(state.status!=='rendering' || !encoder || encoder.exitCode!==null) throw new Error('编码进程不可写');
          if(request.headers['content-type']!=='image/png') return respond(response,415,{error:'只接受 PNG'});
          validateFrameIndex(route.slice('/__video/frame/'.length),state.frames,state.total);
          const data=await bodyOf(request);validatePng(data,spec);
          await new Promise((resolve,reject)=>encoder.stdin.write(data,error=>error?reject(error):resolve()));
          state.frames++;if(state.frames%24===0 || state.frames===state.total) await saveState();
          return respond(response,200,{received:state.frames});
        }
        if(route==='/__video/finish') {
          if(state.status!=='rendering' || state.frames!==state.total) return respond(response,409,{error:'帧数不足，不能发布成片'});
          state.status='encoding';await saveState();encoder.stdin.end();
          const result=await completion;
          if(result.code!==0) throw new Error(`FFmpeg 失败：${result.code} ${result.error ?? ''}`);
          const probe=await runFile('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',temporary],{windowsHide:true,maxBuffer:1024*1024});
          const metadata=JSON.parse(probe.stdout);
          if(!validProbe(metadata,spec)) throw new Error('视频参数或帧数未通过验证');
          await writeFile(path.join(outputDir,'ffprobe.json'),JSON.stringify(metadata,null,2));
          await rename(temporary,output);
          state.status='complete';await saveState();
          return respond(response,200,{ok:true,url:'/media/'+spec.filename,filename:spec.filename});
        }
        return respond(response,404,{error:'未知接口'});
      } finally {busy=false;}
    }
    if(!['GET','HEAD'].includes(request.method)) return respond(response,405,{error:'方法不允许'});
    if(route==='/media/'+spec.filename && state.status==='complete') return await sendFile(request,response,output,'video/mp4');
    const file=assets.get(route==='/'?'/export.html':route);
    if(!file) return respond(response,404,{error:'资源不存在'});
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.json':'application/json'};
    await sendFile(request,response,file,types[path.extname(file)] ?? 'application/octet-stream');
  } catch(error) {
    console.error(error);
    if(authorizedWrite && encoder && !['ready','complete'].includes(state.status)) {
      state.status='failed';state.error=error.message;encoder.stdin.destroy();if(encoder.exitCode===null) encoder.kill();await saveState();
    }
    if(!response.headersSent) respond(response,400,{error:error.message});else response.destroy();
  }
});
server.requestTimeout=120000;
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
state.port=server.address().port;state.url=`http://127.0.0.1:${state.port}`;
await saveState();
// 本机一次性凭据单独存放于被忽略的文件，绝不写入 stdout / FFmpeg 日志。
await writeFile(path.join(cwd,'video-export-session.local'),JSON.stringify({runId,token,url:state.url}));
console.log(JSON.stringify({event:'ready',...state}));
function stop(){if(encoder && encoder.exitCode===null) encoder.kill();server.close(()=>process.exit(0));}
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,stop);
setInterval(()=>{
  if(state.status==='rendering' && Date.now()-lastActivity>300000) {
    state.status='failed';state.error='五分钟未收到后续帧，已停止本任务编码进程';
    if(encoder && encoder.exitCode===null) encoder.kill();void saveState();console.error(state.error);
  }
},30000).unref();
