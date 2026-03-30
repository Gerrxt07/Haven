import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@electron': resolve(__dirname, './electron'),
    },
  },
  plugins: [
    solidPlugin(),
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
