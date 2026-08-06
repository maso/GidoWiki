/**
 * Zero-dependency static build for GidoHome.
 *
 * Why this exists: the Cowork sandbox can't fetch npm platform binaries, so
 * `vite build` isn't runnable there. This script produces an equivalent
 * deployable `dist/` using nothing but Node's standard library:
 *
 *   - copies src/ as native ES modules (no bundling needed — the code is
 *     already browser-compatible except for two Vite-isms handled below)
 *   - maps the bare `import ... from 'three'` specifier to a vendored
 *     three.module.min.js (v0.160.1) via an import map
 *   - strips the Vite-only `import './style.css'` from main.js and links the
 *     stylesheet from index.html instead
 *
 * Local development is unchanged: keep using `npm run dev` (Vite).
 * `npm run build` (Vite) also still works and produces a bundled dist/ —
 * both outputs deploy fine under a subpath thanks to relative URLs.
 *
 * Usage: node scripts/build.mjs
 */
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// 0. Auto-calculate version string from Git commit count & short hash
let versionString = 'v1.0.0';
try {
  const commitCount = execSync('git rev-list --count HEAD', { cwd: root, encoding: 'utf8' }).trim();
  const shortHash   = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  versionString = `v1.0.${commitCount}${shortHash ? ` (${shortHash})` : ''}`;
} catch (e) {}

// Update src/version.js
writeFileSync(join(root, 'src', 'version.js'), `export const APP_VERSION = '${versionString}';\n`);

// Update root index.html version badge
let rootHtml = readFileSync(join(root, 'index.html'), 'utf8');
rootHtml = rootHtml.replace(
  /<div id="version-badge" aria-label="版本號">[^<]*<\/div>/,
  `<div id="version-badge" aria-label="版本號">${versionString}</div>`
);
writeFileSync(join(root, 'index.html'), rootHtml);

// Plain readdir/copyFile walk — fs.cpSync's directory-metadata copying hits
// EACCES on some mounted filesystems (e.g. the Cowork sandbox mount).
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name.endsWith('.test.js')) continue;
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else copyFileSync(src, dst);
  }
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Source modules (already valid browser ES modules)
copyDir(join(root, 'src'), join(dist, 'src'));

// 2. Strip the Vite-only CSS import from main.js
const mainPath = join(dist, 'src', 'main.js');
const main = readFileSync(mainPath, 'utf8').replace(/^import '\.\/style\.css';\n/m, '');
writeFileSync(mainPath, main);

// 3. Vendored three.js
copyDir(join(root, 'vendor'), join(dist, 'vendor'));

// 4. index.html: import map + stylesheet + relative module path
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(
  '</head>',
  `<link rel="stylesheet" href="./src/style.css">
<script type="importmap">
{ "imports": { "three": "./vendor/three.module.min.js" } }
</script>
</head>`,
);
html = html.replace('<script type="module" src="/src/main.js">', '<script type="module" src="./src/main.js">');
writeFileSync(join(dist, 'index.html'), html);

console.log(`dist/ built for ${versionString} (no-bundler static build)`);

