// First-load budget (docs/architecture.md, "Performance budget"): the gzip size of what
// dist/index.html makes every visitor download before the first page (its scripts, the modules
// it preloads and its stylesheets). Run after `pnpm build`; fails when a budget is exceeded, so a
// heavy dependency or an eager import is caught in review instead of by users.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// CSS 22.0: the type scale (named sizes, phone and wide values) and the finder's phone layout add
// about 0.5 KB of shared utility classes (2026-11-21).
// JS 187.2: the supervisor panel's client-services routes and nav (my services, their report, scopes; 2026-11-20).
// JS 187.4, CSS 21.5: the phone header lists the panels in the account menu (PanelChoices) and has
// smaller sizes (2026-11-21). JS 187.6: that panel list folds away on phones (2026-11-21).
// CSS 22.2: the finder's found-routes row, its phone results bar and the button scale (2026-11-21).
// JS 187.7: a case's tab per service, its route (2026-11-21).
// JS 188.4: the error screen's support code and the API client's request ID, which must work when a
// page's own code fails to load; the crash reporter itself loads only on a failure (2026-11-22).
// JS 189.1: the supervisor manager's section, its six sub-tab routes (team cases, team, moving
// cases, service settings) and their two queries, 0.7 KB (2026-11-22).
// JS 189.8: Executive Panel role, navigation and route prefetch definitions (2026-11-22).
const BUDGET_KB = { js: 189.8, css: 22.2 };
const DIST = 'dist';

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="[^"]*?\/(assets\/[^"]+\.(js|css))"/g)].map(
  ([, path, type]) => ({ path, type }),
);
if (files.length === 0) {
  console.error('check-size: no assets found in dist/index.html (run `pnpm build` first).');
  process.exit(1);
}

const totals = { js: 0, css: 0 };
for (const { path, type } of files) {
  totals[type] += gzipSync(readFileSync(join(DIST, path)), { level: 9 }).length / 1024;
}

let failed = false;
for (const type of ['js', 'css']) {
  const line = `${type.toUpperCase()} ${totals[type].toFixed(1)} KB gzip (budget ${BUDGET_KB[type]} KB)`;
  if (totals[type] > BUDGET_KB[type]) {
    console.error(`check-size: over budget: ${line}`);
    failed = true;
  } else console.log(`check-size: ${line}`);
}
process.exit(failed ? 1 : 0);
