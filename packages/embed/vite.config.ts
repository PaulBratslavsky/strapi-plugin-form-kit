import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StrapiForms',
      fileName: (format) => {
        if (format === 'es') return 'embed.mjs';
        if (format === 'cjs') return 'embed.js';
        if (format === 'iife') return 'embed.iife.js';
        return `embed.${format}.js`;
      },
      formats: ['es', 'cjs', 'iife'],
    },
    target: 'es2018',
    minify: 'terser',
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'styles.css';
          return assetInfo.name ?? 'asset-[hash][extname]';
        },
      },
    },
  },
});
