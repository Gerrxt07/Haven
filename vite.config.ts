import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'node:path';

const isTauriDebug = process.env.TAURI_DEBUG === 'true';
const isWindowsTarget = process.env.TAURI_ENV_PLATFORM === 'windows';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [solidPlugin()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    port: 1420,
    strictPort: true,
  },
  preview: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: isWindowsTarget ? 'chrome105' : 'safari13',
    minify: isTauriDebug ? false : 'esbuild',
    sourcemap: isTauriDebug,
  },
});
