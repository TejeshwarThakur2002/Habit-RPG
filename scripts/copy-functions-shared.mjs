// @ts-check
// Copies game-core and shared into supabase/functions/_shared so Edge Functions can import
// them (DECISIONS.md D5). Supabase deploys each function with what is under
// supabase/functions; files elsewhere in the monorepo are not guaranteed to be bundled.
//
//   node scripts/copy-functions-shared.mjs          write the copy
//   node scripts/copy-functions-shared.mjs --check  fail if the copy is out of date (CI)

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const target = join(root, 'supabase/functions/_shared');
const packages = { 'game-core': 'packages/game-core/src', shared: 'packages/shared/src' };
const check = process.argv.includes('--check');

/** Every file the copy should contain, as { path relative to target: contents }. */
function expectedFiles() {
  /** @type {Record<string, string>} */
  const files = {};
  for (const [name, source] of Object.entries(packages)) {
    for (const file of readdirSync(join(root, source)).sort()) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const header =
        `// Generated from ${source}/${file} by scripts/copy-functions-shared.mjs.\n` +
        '// Do not edit; change the source and run `pnpm functions:shared`.\n\n';
      files[join(name, file)] = header + readFileSync(join(root, source, file), 'utf8');
    }
  }
  return files;
}

/** Files currently in the copy, as { path relative to target: contents }. */
function currentFiles() {
  /** @type {Record<string, string>} */
  const files = {};
  for (const name of Object.keys(packages)) {
    let entries = [];
    try {
      entries = readdirSync(join(target, name));
    } catch {
      continue; // Not copied yet; every expected file will be reported as missing.
    }
    for (const file of entries) {
      files[join(name, file)] = readFileSync(join(target, name, file), 'utf8');
    }
  }
  return files;
}

const expected = expectedFiles();

if (check) {
  const current = currentFiles();
  const paths = new Set([...Object.keys(expected), ...Object.keys(current)]);
  const stale = [...paths].filter((path) => expected[path] !== current[path]).sort();
  if (stale.length > 0) {
    console.error(`supabase/functions/_shared is out of date (${stale.join(', ')}).`);
    console.error('Run `pnpm functions:shared` and commit the result.');
    process.exit(1);
  }
  console.log(`supabase/functions/_shared is up to date (${paths.size} files).`);
} else {
  for (const name of Object.keys(packages))
    rmSync(join(target, name), { recursive: true, force: true });
  for (const [path, contents] of Object.entries(expected)) {
    mkdirSync(join(target, path, '..'), { recursive: true });
    writeFileSync(join(target, path), contents);
  }
  console.log(`Copied ${Object.keys(expected).length} files to ${relative(root, target)}.`);
}
