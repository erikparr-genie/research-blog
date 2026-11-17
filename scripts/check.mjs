#!/usr/bin/env node
// Checks the built site (dist/): every internal link and media reference must
// resolve to a file, and none of the scrub patterns may appear anywhere.
//   npm run build && npm run check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BASE = '/research-blog';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(DIST);
const rel = (f) => path.relative(DIST, f);
let errors = 0;
const fail = (msg) => { errors++; console.error('ERROR ' + msg); };

// ---- links and media
let refs = 0;
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(f, 'utf8');
  const pageUrl = '/' + rel(f).replace(/index\.html$/, '');
  for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]+)"/g)) {
    const raw = m[1].replace(/&amp;/g, '&');
    if (/^(?:https?:|mailto:|data:|#)/.test(raw)) continue;
    refs++;
    const resolved = new URL(raw, 'https://x' + BASE + pageUrl).pathname;
    if (!resolved.startsWith(BASE + '/')) { fail(`${rel(f)}: link leaves the base path: ${raw}`); continue; }
    let target = path.join(DIST, decodeURIComponent(resolved.slice(BASE.length)));
    if (resolved.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) fail(`${rel(f)}: broken reference ${raw}`);
  }
}

// ---- every published media file is used, every video has the required attributes
const used = new Set();
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/"\/research-blog\/(media\/[^"]+)"/g)) used.add(m[1]);
  for (const v of html.matchAll(/<video\b[^>]*>/g)) {
    for (const attr of ['controls', 'muted', 'playsinline', 'preload="metadata"']) {
      if (!v[0].includes(attr)) fail(`${rel(f)}: <video> without ${attr}`);
    }
  }
}
const mediaFiles = files.filter((f) => rel(f).startsWith('media/'));
for (const f of mediaFiles) if (!used.has(rel(f))) fail(`unused media file: ${rel(f)}`);

// ---- scrub patterns (text files: full scan; binaries: embedded strings)
const PATTERNS = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g, 'email address'],
  [/Users\//g, 'home path'],
  [/allowlist|quarantin/gi, 'mail handling'],
  [/\b(?:sk|pk|rk)_[A-Za-z0-9]{6,}|\bsk-[A-Za-z0-9-]{12,}|\bhf_[A-Za-z0-9]{12,}|\bgh[opsu]_[A-Za-z0-9]{12,}/g, 'credential-like string'],
  [/firecrawl/gi, 'Firecrawl accounting'],
  [/github\.com\/erikparr-genie\/(?:unity-comfy|agent-directed-production|ai-video-production)/g, 'private repo link'],
  [/decisions needed/gi, 'decisions section'],
];
// Private names: scripts/private-terms.txt (gitignored) or SCRUB_TERMS, as in import.mjs.
const termsFile = path.join(ROOT, 'scripts/private-terms.txt');
for (const t of [...(fs.existsSync(termsFile) ? fs.readFileSync(termsFile, 'utf8').split('\n') : []), ...(process.env.SCRUB_TERMS || '').split(',')]) {
  const term = t.trim();
  if (term && !term.startsWith('#')) PATTERNS.push([new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), 'private term']);
}
const isText = (f) => /\.(html|xml|css|js|json|svg|txt)$/.test(f);
const report = {};
for (const f of files) {
  const buf = fs.readFileSync(f);
  const text = isText(f) ? buf.toString('utf8') : (buf.toString('latin1').match(/[\x20-\x7e]{8,}/g) || []).join('\n');
  for (const [re, what] of PATTERNS) {
    for (const m of text.matchAll(re)) fail(`${rel(f)}: ${what}: "${m[0]}"`);
  }
  // Informational: words on the review list that have legitimate uses.
  if (isText(f)) {
    for (const w of ['@', 'token']) {
      const n = text.toLowerCase().split(w).length - 1;
      if (n) (report[w] ||= []).push(`${rel(f)} ×${n}`);
    }
  }
}

const size = mediaFiles.reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`pages: ${files.filter((f) => f.endsWith('.html')).length}, internal references checked: ${refs}`);
console.log(`media: ${mediaFiles.length} files, ${(size / 1e6).toFixed(1)} MB (videos: ${mediaFiles.filter((f) => f.endsWith('.mp4')).length})`);
for (const [w, list] of Object.entries(report)) console.log(`info: "${w}" appears in ${list.length} file(s): ${list.slice(0, 6).join(', ')}${list.length > 6 ? ', …' : ''}`);
if (errors) { console.error(`\n${errors} error(s)`); process.exit(1); }
console.log('OK: no broken references, no scrub hits');
