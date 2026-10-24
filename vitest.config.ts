import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.node-globals.ts', './src/test/setup.ts'],
      css: false,
      testTimeout: 20_000,
    },
  }),
);
