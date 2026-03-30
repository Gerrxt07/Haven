import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@electron': resolve(__dirname, './electron'),
    },
  },
  plugins: [
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
            rollupOptions: {
              output: {
                format: 'cjs',
              },
            },
          },
          resolve: {
            alias: {
              '@electron': resolve(__dirname, './electron'),
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
            rollupOptions: {
              output: {
                format: 'cjs',
              },
            },
          },
          resolve: {
            alias: {
              '@electron': resolve(__dirname, './electron'),
            },
          },
        },
      },
    ]),
    renderer(),
  ],
});
