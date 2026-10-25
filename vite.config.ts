import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Connect, defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The panel is served by nginx under /panel/ on the same domain as Django,
// so the Django session cookie and CSRF token work without CORS.
const BASE = '/panel/';

// `/panel` (no trailing slash) would otherwise get Vite's "did you mean /panel/?" page.
const redirectBareBase = (): Plugin => {
  const bare = BASE.slice(0, -1);
  const redirect: Connect.NextHandleFunction = (req, res, next) => {
    const [path, query] = (req.url ?? '').split(/\?(.*)/s);
    if (path !== bare) {
      next();
      return;
    }
    res.writeHead(301, { Location: query ? `${BASE}?${query}` : BASE }).end();
  };
  return {
    name: 'redirect-bare-base',
    configureServer: (server) => void server.middlewares.use(redirect),
    configurePreviewServer: (server) => void server.middlewares.use(redirect),
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.SCORIZE_BACKEND_URL || 'http://127.0.0.1:8000';

  return {
    base: BASE,
    plugins: [
      redirectBareBase(),
      react(),
      tailwindcss(),
      VitePWA({
        // Off until the PWA milestone: the manifest ships now, the service worker later.
        // Flip to true (and see docs/PWA.md) to turn on offline caching and install prompts.
        disable: env.VITE_ENABLE_PWA !== 'true',
        registerType: 'prompt',
        injectRegister: false,
        manifest: false, // public/manifest.webmanifest is the source of truth
        workbox: {
          navigateFallback: `${BASE}index.html`,
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
          // Rare font subsets (math, symbols) load on demand instead of on install.
          globIgnores: ['**/*-{math,symbols}-*.woff2'],
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Everything that is not the panel goes to the local Django server (scorize repo).
      proxy: Object.fromEntries(
        ['/api', '/profile', '/static', '/media', '/admin'].map((path) => [
          path,
          { target: backend, changeOrigin: false },
        ]),
      ),
    },
    build: {
      target: 'es2022',
      sourcemap: 'hidden',
      // Warn in review if a dependency bloats the first load (react-dom alone is ~190 kB raw).
      chunkSizeWarningLimit: 250,
      rolldownOptions: {
        output: {
          // Libraries change rarely, app code changes every deploy: separate chunks keep the
          // library chunks cached in users' browsers across deploys.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor', test: /node_modules[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
