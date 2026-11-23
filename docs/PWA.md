# PWA

Scorize can be installed from Android Chrome or added to the home screen from iOS Safari. The
manifest uses relative URLs so the same app assets work both at `/panel/` and at the root of
`panel.scorize.com`. The Docker build enables the service worker by default.

## Preview

```sh
VITE_ENABLE_PWA=true pnpm build
pnpm preview
```

The local preview uses `/panel/`. Set `PANEL_BASE=/` for both commands to preview the production
layout. Service workers require HTTPS or localhost. See [deployment](../deploy/README.md) for
the production image.

## Behavior

- Workbox precaches the app shell and static build assets. Sign-in and private data require a
  connection to Django. No API responses are cached by the service worker.
- The worker leaves Django proxy routes out of the app-shell navigation fallback, including when
  the worker is scoped to the root of the panel domain.
- A new build waits until the user accepts the update banner or closes all pages using the old
  worker. The panel asks before reloading an open page.
- nginx serves the worker and manifest with `Cache-Control: no-cache` and the manifest as
  `application/manifest+json`.

## Staging checklist

1. Install on Android Chrome and use Safari’s **Add to Home Screen** on iOS. Launch from the home
   screen, sign in and out, and open a direct panel link.
2. Launch again offline and verify the shell can load and the panel requires a connection for
   private data.
3. With a form open, deploy a second PWA-enabled build. Check that the banner appears and the page
   reloads into the new build only after accepting the update.

When rolling back application code after releasing the service worker, publish an image with
`VITE_ENABLE_PWA=true` so installed clients can receive the rollback. Omitting the service worker
file does not remove registrations already in users’ browsers.
