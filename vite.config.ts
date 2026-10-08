import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));

export default defineConfig({
  root: path('./app'),
  server: {
    host: '127.0.0.1',
    port: 0,
    open: false,
    fs: { strict: true, allow: [path('./app'), path('./node_modules')] },
  },
  build: { outDir: path('./dist'), emptyOutDir: true },
});
