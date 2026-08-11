/**
 * Stamps the current Git revision into the app.
 *
 * This project is served straight from source: index.html carries the import
 * map and relative paths, and src/ + vendor/ sit next to it in the repo, so
 * GitHub Pages can host the folder as-is. There is no build output to
 * generate — the only generated artefacts are the version strings below.
 *
 * Writes:
 *   src/version.js   → APP_VERSION, shown in the corner badge at runtime
 *   index.html       → the same string, so the badge is correct before JS runs
 *
 * Usage: node scripts/stamp-version.mjs   (npm run version:stamp)
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let versionString = 'v1.0.0';
try {
  const commitCount = execSync('git rev-list --count HEAD', { cwd: root, encoding: 'utf8' }).trim();
  const shortHash = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  versionString = `v1.0.${commitCount}${shortHash ? ` (${shortHash})` : ''}`;
} catch {
  // Not a Git checkout (or Git unavailable) — fall back to the default.
}

writeFileSync(join(root, 'src', 'version.js'), `export const APP_VERSION = '${versionString}';\n`);

const indexPath = join(root, 'index.html');
const html = readFileSync(indexPath, 'utf8').replace(
  /<div id="version-badge" aria-label="版本號">[^<]*<\/div>/,
  `<div id="version-badge" aria-label="版本號">${versionString}</div>`,
);
writeFileSync(indexPath, html);

console.log(`stamped ${versionString}`);
