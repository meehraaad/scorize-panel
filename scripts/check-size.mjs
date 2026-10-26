// First-load budget (docs/architecture.md, "Performance budget"): the gzip size of what
// dist/index.html makes every visitor download before the first page (its scripts, the modules
// it preloads and its stylesheets). Run after `pnpm build`; fails when a budget is exceeded, so a
// heavy dependency or an eager import is caught in review instead of by users.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = { js: 170, css: 18 };
const DIST = 'dist';

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/panel\/(assets\/[^"]+\.(js|css))"/g)].map(
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
