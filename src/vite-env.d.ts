/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** "true" turns on the service worker (offline cache, install, update prompt). */
  readonly VITE_ENABLE_PWA?: string;
  /** Dev only: "true" serves the API from src/mocks (MSW) instead of Django. */
  readonly VITE_API_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
