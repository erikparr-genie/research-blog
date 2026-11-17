#!/usr/bin/env node
// Regenerates the posts and media of this blog from the (private, read-only)
// research repo. Nothing is ever written to the source repo.
//
//   node scripts/import.mjs                 # sources at ../ai-video-production
//   RESEARCH_SRC=/path/to/ai-video-production node scripts/import.mjs
//
// Output (all committed to this repo):
//   src/content/briefs/<date>.md            one per scheduled run that wrote a brief
//   src/content/experiments/<slug>.md       one per experiment lab note
//   public/media/<experiment-slug>/<file>   see scripts/media-manifest.mjs
//
// The script scrubs what must not be published (see README, "What the import
// removes") and exits non-zero if a forbidden pattern survives.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import manifest from './media-manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(ROOT, process.env.RESEARCH_SRC || '../ai-video-production');
const OUT_BRIEFS = path.join(ROOT, 'src/content/briefs');
const OUT_EXPS = path.join(ROOT, 'src/content/experiments');
const OUT_MEDIA = path.join(ROOT, 'public/media');

// Each branch: where its experiment notes and its own (older) run folders live.
const BRANCHES = [
  { tag: 'unity-comfy', dir: 'branches/unity-comfy' },
  { tag: 'agent-directed', dir: 'branches/agent-directed-production' },
];
// Run folders. Runs at the top level cover both branches.
const RUN_DIRS = [
  { dir: 'agent/runs', defaultTags: [] },
  { dir: 'branches/unity-comfy/agent/runs', defaultTags: ['unity-comfy'] },
  { dir: 'branches/agent-directed-production/agent/runs', defaultTags: ['agent-directed'] },
];
const MEDIA_BRANCH = 'branches/unity-comfy';

const PRIVATE_REPO_URL = /https?:\/\/github\.com\/erikparr-genie\/(?:unity-comfy|agent-directed-production|ai-video-production)(?:\/[^\s)>\]]*)?/g;

// Brief sections that are internal and never published.
const DROP_SECTIONS = [/^decisions needed/i, /^budget/i];
// Brief lines that are internal (mail handling, pointers to local folders).
const DROP_LINES = [
  /quarantin/i,
  /allowlist/i,
  /reply to this email/i,
  /\bno instructions\b/i,
  /^\s*-\s*Media(?: \(local\))?:\s*`?media\//i,
  /firecrawl/i,
  /^\s*-\s*Grid:\s*`?media\//i,
];
// "Next run" bullets that only make sense next to the removed decisions.
const DROP_NEXT = /^\s*-\s*(?:\[[^\]]+\]\s*)?If (?:yes\b|you\b|the plan is approved|access is granted|approved)/i;

// Light editing for publication: exact replacements of sentences addressed to
// the author. Keyed by source file name (brief: run folder name). Each entry
// must match, so a changed source is noticed. '' deletes the text.
const EDITS = (await import('./edits.mjs')).default;

const warnings = [];
const removed = { sections: 0, lines: 0, privateLinks: 0, internalLinks: 0, paths: 0, edits: 0 };

// ---------------------------------------------------------------- helpers

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const listDirs = (p) => (exists(p) ? fs.readdirSync(p).filter((n) => fs.statSync(path.join(p, n)).isDirectory()).sort() : []);

function yaml(obj) {
  // JSON values are valid YAML flow scalars/collections.
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
}

// Apply `fn` only outside fenced code blocks and inline code spans.
function outsideCode(md, fn) {
  const lines = md.split('\n');
  let fenced = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, i) => (i % 2 === 1 ? part : fn(part)))
        .join('');
    })
    .join('\n');
}

function scrubPaths(text) {
  const before = text;
  text = text
    .replace(/(?:\/private)?\/tmp\/claude-\d+\/\S*/g, '$TMP/…')
    .replace(/\/Users\/[^/\s`"')]+\/ComfyUI-Installs\/ComfyUI\b/g, '$COMFY_INSTALL')
    .replace(/\/Users\/[^/\s`"')]+\/ComfyUI-Shared\/models\b/g, '$COMFY_MODELS')
    .replace(/\/Users\/[^/\s`"')]+\/__research\/(?:ai-video-production\/)?/g, '')
    .replace(/\/Users\/[^/\s`"')]+/g, '$HOME')
    .replace(/~\/ComfyUI-Installs\/ComfyUI\b/g, '$COMFY_INSTALL')
    .replace(/~\/ComfyUI-Shared\/models\b/g, '$COMFY_MODELS')
    .replace(/(^|[\s`("'[])~\//g, '$1$HOME/');
  if (text !== before) removed.paths++;
  return text;
}

function applyEdits(key, text) {
  for (const [from, to] of EDITS[key] || []) {
    if (!text.includes(from)) {
      warnings.push(`edit did not match in ${key}: "${from.slice(0, 60)}…"`);
      continue;
    }
    text = text.split(from).join(to);
    removed.edits++;
  }
  return text;
}

function plainSummary(md, max = 220) {
  let s = md
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\\([~<*_])/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return s;
}

// ---------------------------------------------------------------- collect sources

const experiments = []; // { slug, file, tag }
for (const b of BRANCHES) {
  const dir = path.join(SRC, b.dir, 'raw/sources/experiments');
  if (!exists(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    const name = f.replace(/\.md$/, '');
    // `name` is the source file name; `slug` is the public URL segment (no dots).
    experiments.push({ name, slug: name.replace(/\./g, '-'), file: path.join(dir, f), tag: b.tag });
  }
}
const expBySlug = new Map(experiments.map((e) => [e.name, e])); // keyed by source name

const briefs = []; // { slug, run, file, defaultTags }
const skippedRuns = [];
for (const r of RUN_DIRS) {
  for (const run of listDirs(path.join(SRC, r.dir))) {
    const file = path.join(SRC, r.dir, run, 'brief.md');
    if (!exists(file)) {
      skippedRuns.push(`${run} (no brief.md)`);
      continue;
    }
    const text = read(file);
    if (/^Subject:.*did not produce a brief/im.test(text.split('\n', 3).join('\n'))) {
      skippedRuns.push(`${run} (run failed; crash notice only)`);
      continue;
    }
    briefs.push({ run, file, defaultTags: r.defaultTags });
  }
}
// Slug: the date; add the time only if two briefs share a date.
const perDate = {};
for (const b of briefs) (perDate[b.run.slice(0, 10)] ||= []).push(b);
for (const b of briefs) {
  const date = b.run.slice(0, 10);
  b.date = date;
  b.slug = perDate[date].length > 1 ? b.run.replace('_', '-') : date;
}
const briefByRun = new Map(briefs.map((b) => [b.run, b]));

// Titles are needed before bodies (for link text).
for (const e of experiments) {
  const text = read(e.file);
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!fm) throw new Error(`no frontmatter: ${e.file}`);
  e.fm = {};
  for (const line of fm[1].split('\n')) {
    const m = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (m) e.fm[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
  }
  e.title = e.fm.title;
  e.date = e.fm.date || e.slug.slice(0, 10);
  e.short = (/^(Experiment \d+)/.exec(e.title) || [null, 'lab note'])[1];
  e.body = text.slice(fm[0].length);
}

// ---------------------------------------------------------------- links

// kind: 'brief' | 'experiment' — decides the relative prefix.
function expLink(slug, from) {
  return from === 'experiment' ? `../${slug}/` : `../../experiments/${slug}/`;
}
function briefLink(slug, from) {
  return from === 'brief' ? `../${slug}/` : `../../briefs/${slug}/`;
}

function rewriteLinks(text, from) {
  // 1. URLs into the private repos.
  text = text.replace(PRIVATE_REPO_URL, (url) => {
    const m = /raw\/sources\/experiments\/([^/\s#?]+)\.md/.exec(url);
    if (m && expBySlug.has(m[1])) {
      removed.internalLinks++;
      const e = expBySlug.get(m[1]);
      return `[${e.short}](${expLink(e.slug, from)})`;
    }
    removed.privateLinks++;
    return '\u0000';
  });
  // Markdown links whose target was private: keep the text only.
  text = text.replace(/\[([^\]]+)\]\(\u0000\)/g, '$1');
  // Bare private URLs: drop them with their lead-in arrow (whole line if alone).
  text = text.replace(/\n[ \t]*(?:→|->)?[ \t]*\u0000[ \t]*(?=\n|$)/g, '');
  text = text.replace(/[ \t]*(?:→|->)?[ \t]*\u0000/g, '');

  // 2. Repo paths to other published notes/briefs, written as inline code.
  text = text.replace(/`(?:raw\/sources\/experiments\/)([^`/\s]+)\.md`/g, (all, slug) => {
    if (!expBySlug.has(slug)) return all;
    removed.internalLinks++;
    const e = expBySlug.get(slug);
    return `[lab note](${expLink(e.slug, from)})`;
  });
  text = text.replace(/`(?:branches\/[a-z-]+\/)?agent\/runs\/(\d{4}-\d{2}-\d{2}_\d{4})\/brief\.md`/g, (all, run) => {
    const b = briefByRun.get(run);
    if (!b) return all;
    removed.internalLinks++;
    return `[run brief ${b.date}](${briefLink(b.slug, from)})`;
  });
  return text;
}

// Remove bullets that lost their only content (a label followed by a removed link).
function pruneEmptyBullets(lines) {
  const indent = (l) => /^\s*/.exec(l)[0].length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (/^\s*-\s*$/.test(l)) {
      lines.splice(i, 1);
      continue;
    }
    if (/^\s*-\s.*:\s*$/.test(l)) {
      const next = lines[i + 1];
      const hasChild = next !== undefined && next.trim() !== '' && indent(next) > indent(l);
      if (!hasChild) lines.splice(i, 1);
    }
  }
  return lines;
}

// ---------------------------------------------------------------- briefs

function convertBrief(b) {
  let text = read(b.file).replace(/\r\n/g, '\n');
  text = applyEdits(b.run, text);
  const lines = text.split('\n');

  const subj = /^Subject:\s*(.*)$/.exec(lines[0] || '');
  if (!subj) throw new Error(`brief without Subject: ${b.file}`);
  const title = subj[1].replace(/^\[[^\]]+\]\s*/, '').trim();

  // Split into sections. A header is an unindented line that is not a list item
  // and follows a blank line.
  const sections = [];
  let cur = null;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    const prevBlank = i === 1 || lines[i - 1].trim() === '';
    if (prevBlank && l.trim() !== '' && !/^[\s\-*\d]/.test(l) && l.length < 200) {
      cur = { head: l.trim(), lines: [] };
      sections.push(cur);
    } else if (cur) {
      cur.lines.push(l);
    }
  }

  const tags = new Set(b.defaultTags);
  const out = [];
  let summary = '';
  for (const s of sections) {
    if (DROP_SECTIONS.some((re) => re.test(s.head))) {
      removed.sections++;
      continue;
    }
    let head = s.head;
    let body = s.lines.slice();
    // "Implementation progress (lab note: URL)" -> heading + a line.
    const paren = /^(.*?)\s*\((lab note:[^)]*)\)\s*$/i.exec(head);
    if (paren) {
      head = paren[1];
      body.unshift(`- ${paren[2][0].toUpperCase()}${paren[2].slice(1)}`);
    }
    body = body.filter((l) => {
      const drop = DROP_LINES.some((re) => re.test(l)) || (/^next run/i.test(head) && DROP_NEXT.test(l));
      if (drop) removed.lines++;
      return !drop;
    });
    let md = body.join('\n');
    for (const m of md.matchAll(/\[(unity-comfy|agent-directed)\]/g)) tags.add(m[1]);
    md = scrubPaths(md);
    // The brief is plain text: neutralise characters markdown would interpret.
    md = outsideCode(md, (t) => t.replace(/</g, '&lt;').replace(/~/g, '\\~').replace(/\*/g, '\\*'));
    md = rewriteLinks(md, 'brief');
    // Branch markers read better as inline code than as bracketed text.
    md = md.replace(/\[(unity-comfy|agent-directed)\]/g, '`$1`');
    md = pruneEmptyBullets(md.split('\n')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!md) continue;
    if (!summary && /^tl;?dr/i.test(head)) {
      const first = /^-\s+([\s\S]*?)(?=\n\s*-\s|\n\n|$)/.exec(md);
      if (first) summary = plainSummary(first[1]);
    }
    out.push(`## ${head}\n\n${md}`);
  }
  if (tags.size === 0) tags.add('unity-comfy');

  const media = mediaFor((m) => m.brief && m.post.slice(0, 10) === b.date);
  const related = experiments.filter((e) => e.date === b.date).map((e) => e.slug);
  const fm = yaml({
    title,
    date: b.date,
    run: b.run,
    tags: [...tags].sort(),
    summary,
    related,
    media,
  });
  return `---\n${fm}\n---\n\n${out.join('\n\n')}\n`;
}

// ---------------------------------------------------------------- experiments

function convertExperiment(e) {
  let body = applyEdits(path.basename(e.file), e.body.replace(/\r\n/g, '\n'));
  // The page layout prints the title.
  body = body.replace(/^\s*# .*\n+/, '');
  body = scrubPaths(body);
  body = outsideCode(body, (t) => t.replace(/~/g, '\\~'));
  body = rewriteLinks(body, 'experiment');
  const method = e.fm.method ? scrubPaths(e.fm.method).replace(/`/g, '') : undefined;
  const firstPara = body.split(/\n\s*\n/).find((p) => p.trim() && !/^\s*(#|\||-|\d+\.|```|>)/.test(p)) || '';
  const fm = yaml({
    title: e.title,
    date: e.date,
    tags: [e.tag],
    run: e.fm.run,
    method,
    summary: plainSummary(firstPara),
    media: mediaFor((m) => m.post === e.name),
  });
  return `---\n${fm}\n---\n\n${body.trim()}\n`;
}

// ---------------------------------------------------------------- media

function resolveSrc(pattern) {
  const full = path.join(SRC, MEDIA_BRANCH, pattern);
  if (!pattern.includes('*')) return exists(full) ? [full] : [];
  const dir = path.dirname(full);
  if (!exists(dir)) return [];
  const re = new RegExp('^' + path.basename(full).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return fs.readdirSync(dir).filter((n) => re.test(n)).sort().map((n) => path.join(dir, n));
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

const mediaStats = { copied: 0, kept: 0, missing: 0 };

function buildMedia() {
  for (const m of manifest) {
    if (!expBySlug.has(m.post)) {
      warnings.push(`media-manifest: unknown post ${m.post}`);
      continue;
    }
    const dest = path.join(OUT_MEDIA, expBySlug.get(m.post).slug, m.out);
    const isVideo = m.out.endsWith('.mp4');
    const poster = dest.replace(/\.mp4$/, '.poster.jpg');
    if (exists(dest) && (!isVideo || exists(poster)) && !process.env.FORCE_MEDIA) {
      mediaStats.kept++;
      continue;
    }
    const srcs = resolveSrc(m.src);
    if (srcs.length === 0) {
      mediaStats.missing++;
      warnings.push(`media source not found (skipped): ${m.src}`);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // -map_metadata -1 everywhere: ComfyUI embeds the whole workflow in its outputs.
    const strip = ['-map_metadata', '-1', '-map_chapters', '-1'];
    if (m.seq) {
      const list = dest + '.txt';
      fs.writeFileSync(list, srcs.map((s) => `file '${s.replace(/'/g, "'\\''")}'\nduration ${1 / m.fps}`).join('\n') + '\n');
      ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, ...strip, '-vf', `fps=${m.fps},pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p`, '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-an', dest]);
      fs.rmSync(list);
    } else if (isVideo) {
      if (srcs.length !== 1) throw new Error(`expected one file for ${m.src}, got ${srcs.length}`);
      const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt', '-of', 'csv=p=0', srcs[0]]).toString().trim();
      const codec = probe === 'h264,yuv420p' ? ['-c:v', 'copy'] : ['-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow'];
      ffmpeg(['-i', srcs[0], '-map', '0:v:0', ...strip, ...codec, '-movflags', '+faststart', '-an', dest]);
    } else {
      if (srcs.length !== 1) throw new Error(`expected one file for ${m.src}, got ${srcs.length}`);
      const vf = m.crop ? ['-vf', `crop=${m.crop}`] : [];
      const q = dest.endsWith('.jpg') ? ['-q:v', '3'] : [];
      ffmpeg(['-i', srcs[0], ...strip, ...vf, ...q, '-frames:v', '1', '-update', '1', dest]);
    }
    if (isVideo) {
      // Poster: a frame a third of the way in (the first frame is often black).
      const n = Number(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', dest]).toString().trim()) || 1;
      ffmpeg(['-i', dest, '-vf', `select=eq(n\\,${Math.floor(n / 3)}),scale='min(960,iw)':-2`, '-frames:v', '1', '-update', '1', '-q:v', '5', poster]);
    }
    mediaStats.copied++;
  }
}

function mediaFor(pred) {
  return manifest
    .filter(pred)
    .filter((m) => expBySlug.has(m.post) && exists(path.join(OUT_MEDIA, expBySlug.get(m.post).slug, m.out)))
    .map((m) => {
      const src = `media/${expBySlug.get(m.post).slug}/${m.out}`;
      const item = { src, kind: m.out.endsWith('.mp4') ? 'video' : 'image', caption: m.caption };
      if (item.kind === 'video') item.poster = src.replace(/\.mp4$/, '.poster.jpg');
      return item;
    });
}

// ---------------------------------------------------------------- lint

// Hard failures: none of these may appear in generated posts.
// Names that must never be published (employer, clients, private domains) are
// kept out of this public repo: one term per line in scripts/private-terms.txt
// (gitignored), or comma-separated in the SCRUB_TERMS environment variable.
const termsFile = path.join(ROOT, 'scripts/private-terms.txt');
const PRIVATE_TERMS = [
  ...(exists(termsFile) ? read(termsFile).split('\n') : []),
  ...(process.env.SCRUB_TERMS || '').split(','),
]
  .map((t) => t.trim())
  .filter((t) => t && !t.startsWith('#'))
  .map((t) => [new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), 'private term']);
if (PRIVATE_TERMS.length === 0) warnings.push('no private terms loaded (scripts/private-terms.txt missing): name checks skipped');
const FORBIDDEN = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/, 'email address'],
  [/\/Users\//, 'absolute home path'],
  ...PRIVATE_TERMS,
  [/allowlist|quarantin/i, 'mail handling'],
  [/\b(?:sk|pk|rk)_[A-Za-z0-9]{8,}|\bsk-[A-Za-z0-9-]{16,}|\bhf_[A-Za-z0-9]{16,}|\bgh[opsu]_[A-Za-z0-9]{16,}|\bfc-[a-f0-9]{16,}|AKIA[0-9A-Z]{16}/, 'credential-like string'],
  [/firecrawl/i, 'Firecrawl accounting'],
  [/github\.com\/erikparr-genie\/(?:unity-comfy|agent-directed-production|ai-video-production)/, 'private repo link'],
  [/decisions needed/i, 'decisions section'],
];
// Soft: text that may still be addressed to the author. Review by hand.
const REVIEW = /\b(?:you|your|yours|Erik(?:'s)?)\b/;

function lint(name, text) {
  let bad = false;
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`FORBIDDEN (${what}) ${name}:${i + 1}: ${line.trim().slice(0, 160)}`);
        bad = true;
      }
    }
    if (REVIEW.test(line)) warnings.push(`review (addressed to author?) ${name}:${i + 1}: ${line.trim().slice(0, 140)}`);
  });
  return bad;
}

// ---------------------------------------------------------------- main

if (!exists(SRC)) {
  console.error(`Source repo not found at ${path.relative(ROOT, SRC)}. Set RESEARCH_SRC.`);
  process.exit(2);
}

buildMedia();

for (const dir of [OUT_BRIEFS, OUT_EXPS]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

let failed = false;
for (const b of briefs) {
  const md = convertBrief(b);
  failed = lint(`briefs/${b.slug}.md`, md) || failed;
  fs.writeFileSync(path.join(OUT_BRIEFS, `${b.slug}.md`), md);
}
for (const e of experiments) {
  const md = convertExperiment(e);
  failed = lint(`experiments/${e.slug}.md`, md) || failed;
  fs.writeFileSync(path.join(OUT_EXPS, `${e.slug}.md`), md);
}

for (const w of warnings) console.warn('warn: ' + w);
console.log(`\nbriefs: ${briefs.length}   experiments: ${experiments.length}`);
console.log(`runs without a post: ${skippedRuns.join('; ') || 'none'}`);
console.log(`media: ${mediaStats.copied} written, ${mediaStats.kept} already present, ${mediaStats.missing} missing`);
console.log(`scrub: ${removed.sections} sections, ${removed.lines} lines, ${removed.privateLinks} private links -> text, ${removed.internalLinks} links -> internal, ${removed.edits} manual edits`);
if (failed) {
  console.error('\nForbidden content found in generated posts. Fix the rules in scripts/import.mjs or scripts/edits.mjs.');
  process.exit(1);
}
