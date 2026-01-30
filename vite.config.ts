import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { build } from 'vite';

// Single config that builds everything
// Popup uses module format (loaded as HTML page)
// Content scripts & service worker get inlined (no shared chunks)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'extension-post-build',
      async writeBundle() {
        const distDir = resolve(__dirname, 'dist');

        // Copy pdf.js worker
        const workerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
        if (existsSync(workerSrc)) {
          copyFileSync(workerSrc, resolve(distDir, 'pdf.worker.min.mjs'));
        }

        // Move popup HTML from dist/src/popup/ to dist/popup/
        const srcPopupDir = resolve(distDir, 'src/popup');
        const destPopupDir = resolve(distDir, 'popup');
        if (existsSync(srcPopupDir) && existsSync(resolve(srcPopupDir, 'index.html'))) {
          if (!existsSync(destPopupDir)) mkdirSync(destPopupDir, { recursive: true });
          let html = readFileSync(resolve(srcPopupDir, 'index.html'), 'utf-8');
          html = html.replace(/\.\.\/..\//g, '../');
          writeFileSync(resolve(destPopupDir, 'index.html'), html);
        }

        // Build content scripts as IIFE (separate pass, no code splitting)
        const contentEntries = [
          { name: 'reality-check', path: 'src/content/reality-check/reality-check.ts' },
          { name: 'smart-connect', path: 'src/content/smart-connect/smart-connect.ts' },
          { name: 'salary-intel', path: 'src/content/salary-intel/salary-intel.ts' },
          { name: 'service-worker', path: 'src/background/service-worker.ts' },
        ];

        for (const entry of contentEntries) {
          await build({
            configFile: false,
            resolve: {
              alias: { '@': resolve(__dirname, 'src') },
            },
            build: {
              outDir: distDir,
              emptyOutDir: false,
              lib: {
                entry: resolve(__dirname, entry.path),
                name: entry.name.replace(/-/g, '_'),
                formats: ['iife'],
                fileName: () => `${entry.name}.js`,
              },
              rollupOptions: {
                output: {
                  inlineDynamicImports: true,
                },
              },
            },
          });
        }
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
