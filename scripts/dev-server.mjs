import { createServer } from 'vite';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  configFile: path.join(cwd, 'vite.config.ts'),
  plugins: [{
    name: 'woven-studio-health',
    configureServer(vite) {
      // 在 SPA HTML fallback 前注册，避免健康检查被 index.html 吞掉。
      vite.middlewares.use('/__studio/health', (request, response, next) => {
        if (request.method !== 'GET') return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ task: 'woven-life-tree', pid: process.pid }));
      });
    },
  }],
});
await server.listen();
const address = server.httpServer.address();
if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
  await server.close();
  throw new Error('预览服务没有正确绑定到 127.0.0.1');
}
const state = { task: 'woven-life-tree', pid: process.pid, cwd, port: address.port, url: `http://127.0.0.1:${address.port}`, startedAt: new Date().toISOString() };
await mkdir(path.join(cwd, 'logs'), { recursive: true });
const temporaryStatePath = path.join(cwd, 'logs', `runtime-${process.pid}.tmp`);
await writeFile(temporaryStatePath, JSON.stringify(state, null, 2));
await rename(temporaryStatePath, path.join(cwd, 'logs', 'runtime.json'));
console.log(JSON.stringify(state));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
