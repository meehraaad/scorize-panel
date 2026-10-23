# PWA

## What is already in place

- `public/manifest.webmanifest` (scope and start URL `/panel/`, RTL, theme colors)
- `<meta name="theme-color">` that follows the active theme
- `vite-plugin-pwa` (Workbox) is configured but **disabled**
- `src/pwa/UpdatePrompt.tsx` shows a "new version ready" banner. It never auto-reloads, because the
  user might be in the middle of a form
- nginx sends `no-cache` for `sw.js`, `workbox-*.js` and the manifest, so updates are picked up

## Turning it on

1. Add PNG icons to `public/icons/` (192×192, 512×512, and a 512×512 maskable icon with safe padding)
   and list them in `manifest.webmanifest`. Android's install prompt requires PNG icons.
2. Build with `VITE_ENABLE_PWA=true` (Docker: `--build-arg VITE_ENABLE_PWA=true`).
3. Test in Chrome DevTools → Application → Manifest / Service workers, and with Lighthouse.

## Caching rules

- App shell, JS, CSS and fonts are precached, so the panel opens offline.
- `/api/*` is **never** served from the service worker cache (`navigateFallbackDenylist`). Personal data
  comes from the network, and React Query keeps it in memory.
- Add offline support for specific API data only after deciding what may be shown stale.

## Later

- Web push notifications (needs a push endpoint in Django + VAPID keys)
- Install prompt UI (`beforeinstallprompt`) in Settings
