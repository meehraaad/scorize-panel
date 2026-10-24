import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.node-globals.ts', './src/test/setup.ts'],
      css: false,
      testTimeout: 20_000,
      // Each worker renders the whole app in jsdom (~1 GB): on an 8 GB laptop more workers swap and
      // tests time out instead of finishing sooner.
      maxWorkers: '50%',
    },
  }),
);
