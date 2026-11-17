// Small result figures for notes whose sources contain no image.
// Each one only draws numbers that are already in the note or in its recorded
// result files; the caption in media-manifest.mjs says so.
//
// A generator gets `read(relPath)` (text of a file under the unity-comfy branch)
// and returns an SVG string. Status colours always come with a symbol and a label.

const C = {
  surface: '#fcfcfb',
  ink: '#0b0b0b',
  ink2: '#52514e',
  line: '#e1e0d9',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  neutral: '#c3c2b7',
};
const FONT = `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}" font-family="${FONT}">
<rect width="${w}" height="${h}" fill="${C.surface}"/>
${body}
</svg>
`;
}
const text = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.size || 14}" font-weight="${o.weight || 400}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || 'start'}">${esc(s)}</text>`;

const STATUS = {
  good: { fill: C.good, ink: '#ffffff', mark: '✓' },
  warning: { fill: C.warning, ink: '#0b0b0b', mark: '?' },
  critical: { fill: C.critical, ink: '#ffffff', mark: '!' },
  neutral: { fill: C.neutral, ink: '#0b0b0b', mark: '≈' },
};

/** Experiment 007: outcome of the 20-template conversion comparison. */
function e2Templates() {
  // Counts from the note: 12/20 identical; of the 8 that differ, one changes the
  // prompt, one possibly limits detection, the rest are classified not material.
  const groups = [
    { n: 12, status: 'good', label: 'identical' },
    { n: 6, status: 'neutral', label: 'differences, none material' },
    { n: 1, status: 'warning', label: 'possibly material (SAM3 bboxes default)' },
    { n: 1, status: 'critical', label: 'material (different positive prompt)' },
  ];
  const W = 960, H = 340, s = 64, gap = 8, x0 = 40, y0 = 104;
  let out = text(x0, 44, 'Frontend Save (API) vs comfy-cli conversion: 20 templates', { size: 22, weight: 650 });
  out += text(x0, 72, 'One square per template. Node counts matched in all 20.', { size: 15, fill: C.ink2 });
  let i = 0;
  for (const g of groups) {
    for (let k = 0; k < g.n; k++, i++) {
      const x = x0 + (i % 10) * (s + gap), y = y0 + Math.floor(i / 10) * (s + gap);
      const st = STATUS[g.status];
      out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="6" fill="${st.fill}"/>`;
      out += text(x + s / 2, y + s / 2 + 9, st.mark, { size: 26, weight: 650, fill: st.ink, anchor: 'middle' });
    }
  }
  let ly = y0 + 2 * (s + gap) + 34;
  let lx = x0;
  groups.forEach((g, gi) => {
    const st = STATUS[g.status];
    if (gi === 2) { lx = x0; ly += 34; }
    out += `<rect x="${lx}" y="${ly - 16}" width="20" height="20" rx="4" fill="${st.fill}"/>`;
    out += text(lx + 10, ly, st.mark, { size: 14, weight: 650, fill: st.ink, anchor: 'middle' });
    const label = `${g.n} ${g.label}`;
    out += text(lx + 30, ly, label, { size: 15 });
    lx += 30 + label.length * 7.6 + 36;
  });
  return svg(W, H, '20 templates: 12 identical, 6 with differences that are not material, 1 possibly material, 1 material', out);
}

/** Experiment 011: batched linalg.inv on MPS, per size, before and after. */
function invStatus(read) {
  const rows = [
    { label: 'torch 2.12.1', sub: 'Experiment 008', file: 'raw/assets/experiments/2026-10-23-torch-2.15-mps/torch-2.12.1.json' },
    { label: 'torch 2.15.0 GA', sub: 'PyPI wheel, this note', file: 'raw/assets/experiments/2026-11-03-torch-2.15-ga/torch-2.15.0-ga-inv.json' },
  ].map((r) => ({ ...r, results: JSON.parse(read(r.file)).results }));
  const ns = rows[1].results.map((r) => r.n);
  const W = 960, H = 330, x0 = 220, y0 = 130, cw = 136, ch = 84, gap = 8;
  let out = text(40, 44, 'Batched linalg.inv on MPS, by batch size N', { size: 22, weight: 650 });
  out += text(40, 72, 'Cell value: maximum relative error against the CPU result (float32).', { size: 15, fill: C.ink2 });
  ns.forEach((n, i) => {
    out += text(x0 + i * (cw + gap) + cw / 2, y0 - 14, `N = ${n.toLocaleString('en-US')}`, { size: 14, fill: C.ink2, anchor: 'middle' });
  });
  rows.forEach((row, ri) => {
    const y = y0 + ri * (ch + gap);
    out += text(40, y + ch / 2 - 2, row.label, { size: 16, weight: 650 });
    out += text(40, y + ch / 2 + 18, row.sub, { size: 13, fill: C.ink2 });
    ns.forEach((n, i) => {
      const r = row.results.find((q) => q.n === n);
      const x = x0 + i * (cw + gap);
      let status, top, bottom;
      if (!r || r.crash) { status = 'critical'; top = '! crash'; bottom = r ? r.crash : 'no result'; }
      else if (r.ok) { status = 'good'; top = '✓ ok'; bottom = r.max_rel_err.toExponential(1); }
      else { status = 'critical'; top = '! wrong'; bottom = r.zero_fraction === 1 ? 'all zeros' : r.max_rel_err.toExponential(1); }
      const st = STATUS[status];
      out += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6" fill="${st.fill}"/>`;
      out += text(x + cw / 2, y + 36, top, { size: 17, weight: 650, fill: st.ink, anchor: 'middle' });
      out += text(x + cw / 2, y + 60, bottom, { size: 14, fill: st.ink, anchor: 'middle' });
    });
  });
  return svg(W, H, 'linalg.inv on MPS: torch 2.12.1 returns zeros from N = 65,536 and crashes at 262,144; torch 2.15.0 GA is correct at every size', out);
}

export default { e2Templates, invStatus };
