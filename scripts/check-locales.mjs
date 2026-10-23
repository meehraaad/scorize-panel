// Fails CI when a dictionary is missing a key (or has an extra one) compared to Persian,
// or when a value's {{placeholders}} differ. Persian (fa) is the source of truth.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/locales/', import.meta.url).pathname;
const SOURCE = 'fa';

const flatten = (object, prefix = '') =>
  Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, String(value)]],
  );

const placeholders = (text) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
const load = (locale, file) =>
  new Map(flatten(JSON.parse(readFileSync(join(root, locale, file), 'utf8'))));

const locales = readdirSync(root).filter((name) => name !== SOURCE);
const files = readdirSync(join(root, SOURCE)).filter((name) => name.endsWith('.json'));
const problems = [];

for (const file of files) {
  const source = load(SOURCE, file);
  for (const locale of locales) {
    let target;
    try {
      target = load(locale, file);
    } catch {
      problems.push(`${locale}/${file}: file missing`);
      continue;
    }
    for (const [key, text] of source) {
      if (!target.has(key)) problems.push(`${locale}/${file}: missing "${key}"`);
      else if (placeholders(text).join() !== placeholders(target.get(key)).join())
        problems.push(`${locale}/${file}: placeholders differ in "${key}"`);
      else if (!target.get(key).trim()) problems.push(`${locale}/${file}: empty "${key}"`);
    }
    for (const key of target.keys())
      if (!source.has(key)) problems.push(`${locale}/${file}: extra "${key}" (not in ${SOURCE})`);
  }
}

if (problems.length) {
  console.error(`Locale check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Locales OK: ${files.length} file(s), ${locales.length + 1} language(s).`);
