// Light editing for publication. Exact text replacements applied to a source
// file before conversion, keyed by run folder name (briefs) or note file name
// (experiments). They remove sentences addressed to the author; findings are
// not changed. The import warns if an entry no longer matches its source.
export default {
  '2026-10-06_0700': [
    ['- Your ComfyUI was upgraded', '- ComfyUI was upgraded'],
  ],
  '2026-10-23_0700': [
    ['- Start M1 if you approve: a scripted batch', '- Start M1: a scripted batch'],
  ],
  '2026-11-03_0700': [
    ['First research plan drafted for your review.', 'First research plan drafted.'],
    [' as\n  you decided:', ':'],
    [' I didn\'t touch them; please check.', ' I didn\'t touch them.'],
  ],
  '2026-11-10_0700': [
    [' The plan still waits for your review.', ''],
  ],
  '2026-11-13_0700': [
    [' Your decision on the upgrade test is still open.', ''],
  ],
  '2026-11-03-m1-batch-02-video-3d-templates.md': [
    [", per Erik's 2026-10-27 decision.", ', as decided on 2026-10-27.'],
  ],
  '2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats.md': [
    ['if Erik agrees to the upgrade test.', 'if the upgrade test goes ahead.'],
  ],
};
