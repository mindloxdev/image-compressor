import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// The jSquash codecs resolve their own `.wasm` files with
// `new URL('x.wasm', import.meta.url)`. esbuild's dependency pre-bundling
// rewrites that away, so every codec package must stay un-optimised.
const JSQUASH = [
  '@jsquash/jpeg',
  '@jsquash/png',
  '@jsquash/webp',
  '@jsquash/avif',
  '@jsquash/oxipng',
  '@jsquash/resize',
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  optimizeDeps: { exclude: JSQUASH },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
