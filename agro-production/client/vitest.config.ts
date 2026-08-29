import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  // Components author JSX without importing React (Next.js supplies it). vitest's
  // bare esbuild transform does not, so inject it for the classic runtime.
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
});
