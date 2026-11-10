// Builds the whole app as ONE html file (script, styles and icon inside), e.g. to put on a
// school website or a USB stick. Run after `npm run build`:
//
//   node scripts/single-file.mjs            → dist-single/lineal.html
//
// No service worker and no manifest: the file works offline anyway, it needs nothing else.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf8');
const jsName = /src="\.\/(assets\/[^"]+\.js)"/.exec(html)[1];
const cssName = /href="\.\/(assets\/[^"]+\.css)"/.exec(html)[1];
const icon = `data:image/svg+xml;base64,${readFileSync(new URL('icons/icon.svg', dist)).toString('base64')}`;
const js = readFileSync(new URL(jsName, dist), 'utf8').replaceAll('./icons/icon.svg', icon).replace(/<\/(script)/gi, '<\\/$1');
const css = readFileSync(new URL(cssName, dist), 'utf8');

html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace('href="./icons/icon.svg"', `href="${icon}"`)
  .replace(/\s*<script type="module" crossorigin src="[^"]+"><\/script>/, '')
  .replace(/\s*<link rel="stylesheet" crossorigin href="[^"]+">/, () => `\n    <style>\n${css}\n    </style>`)
  .replace('  </body>', () => `    <script type="module">\n${js}\n    </script>\n  </body>`)
  .replace('<!doctype html>', '<!doctype html>\n<!-- Lineal – Figuren mit dem Lineal nachzeichnen. Die ganze App in einer Datei: https://github.com/Adler78hh/lineal -->');

const out = new URL('../dist-single/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('lineal.html', out), html);
console.log(`dist-single/lineal.html (${Math.round(html.length / 1024)} KB)`);
