import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Where the app is served from: "/" at a domain root (the default), or a project
// path such as "/artfolio-app/" on GitHub Pages. Set with VITE_BASE at build time.
function basePath(): string {
  const raw = (process.env.VITE_BASE ?? '').trim();
  if (!raw) return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
}

// GitHub Pages has no rewrite rules: it serves 404.html for any path it has no
// file for. A copy of index.html there makes deep links (/login, /p/<artist>) load the app.
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  base: basePath(),
  plugins: [react(), tailwindcss(), spaFallback()],
});
