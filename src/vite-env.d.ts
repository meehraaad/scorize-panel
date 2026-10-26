/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** "true" turns on the service worker (offline cache, install, update prompt). */
  readonly VITE_ENABLE_PWA?: string;
  /** Set by vite.config.ts at build time: tells one build's saved cache from another's. */
  readonly VITE_APP_BUILD?: string;
  /** Dev only: "true" serves the API from src/mocks (MSW) instead of Django. */
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
