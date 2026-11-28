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
// JS 196.1, CSS 22.3: what `test` weighed when the HR new-hire form merged in (195.3 / 22.201)
// plus the form's 0.5 KB, as CI measures it on Node 24 (2026-11-23, docs/performance.md).
// JS 196.2, CSS 22.4: enable the PWA build in CI and add the mobile install guide (2026-11-23).
// JS 196.5: the new-staff dialog's account-lookup flag and the hiring follow-ups in shared blocks,
// under 0.1 KB locally, plus CI's Node 24 margin (2026-11-23).
// JS 196.7: main's call-rating routes and test's hiring follow-ups together (+0.2 and +0.3 on 196.2).
// JS 197.4: the Executive customer workspace's nested route definitions and preload entries.
// The workspace screens, data loaders, and styles stay lazy.
// JS 196.4: sales call-rating navigation and routes. Their page and query code stay lazy (2026-11-23).
// JS 197.6: both of the above together, after test and main merged (2026-11-24).
// JS 197.7: 197.6 rounded up; the merged build measures just over 197.6 (2026-11-24).
// JS 197.9, CSS 22.8: the customer head's quick actions: the hover label under icon-only buttons
// (`tip`), the dock, the copy and tablet icons and the chat apps' brand colours, +0.2 JS and +0.3
// CSS locally on test's 197.2 / 22.3; CI's Node 24 measured the merge at 197.7 / 22.7 (2026-11-24).
// Site Health and Acquisition register two routes, one telemetry entry point and report layout styles.
// The report pages, collectors, and Web Vitals library load in separate chunks.
// Staff's tasks above the panels: the bell's combined count with its popup trigger and the /tasks route,
// the bottom tray minimized windows share, and the shared dismiss hook. The popup, the dock and the
// page stay lazy: +1.0 KB JS on test's 198.6; CSS as CI measures it (23.0, 22.9 locally) (2026-11-25).
// JS 199.9: CI on Node 24 measured the merged main just over 199.8 (2026-11-25).
// JS 199.8: main's personal call ratings under Me and test's pathway finder (Australia's nomination question,
// Canada's ranking, what-if) merged measure 199.7; none of the finder's code is in the first load (its what-if
// request has its own file), the rest is the shared chunks' module map (2026-11-25).
// JS 200.0: meeting0's calendar picker in the task composer and the tasks row's chips: their code stays
// lazy; the first load gains only the routes' module-map entries for the shared picker chunk, 199.896 → 199.943
// locally (2026-11-26).
// JS 200.4, CSS 23.1: the branch measured 200.018 / 23.010 on Node 26 before meeting0 round 2; its
// team boards add a «برد» route and nav item to the supervisor, executive and HR panels (pages
// lazy), 200.300 locally (2026-11-26).
// CSS 23.2: the pre-PR audit's dark-mode pills, truncation and focus outlines; CI (Linux) measured
// 23.1x where the local build rounds to 23.0 (2026-11-26).
// JS 200.6: the speed pass keeps the session through a rate limit (429), retries a short one once and
// saves the cache only on real changes; 200.3 → 200.52 locally (2026-11-27).
// JS 200.7: PageHeader isolates a Latin name in Persian titles (<bdi>), which is in the first load; 200.61
// locally (2026-11-27).
const BUDGET_KB = { js: 200.7, css: 23.2 };
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
