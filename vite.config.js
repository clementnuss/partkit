import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        splitter: resolve(__dirname, 'tools/pdf-splitter/index.html'),
        combiner: resolve(__dirname, 'tools/pdf-combiner/index.html'),
        merger: resolve(__dirname, 'tools/pdf-merger/index.html'),
        assembler: resolve(__dirname, 'tools/pdf-assembler/index.html'),
      }
    }
  }
});
