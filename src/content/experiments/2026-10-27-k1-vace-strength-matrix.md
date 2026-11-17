---
title: "Experiment 010 — K1 matrix: Wan VACE strength 0.50–0.75 × 3 styles, depth adherence per tile; model residency slows Wan 1.6×"
date: "2026-10-27"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-27_0700. Local ComfyUI 0.38.2, torch 2.12.1 (Desktop venv), M5 Pro 48 GB. Wan 2.1 VACE 1.3B M0 #1 graph with {{strength}} (workflows/m0/wan21_vace_1.3B_depth_strength_api.json), 832×480, 17 frames, 16 fps, seed 7, Unity depth control uc_demo_street_depth.mp4. Scored with scripts/depth-adherence.py (DA3 small)."
summary: "On 2026-10-23, depth adherence collapsed somewhere between VACE strength 0.8 (MAE ≈ 0.03) and 0.4 (MAE 0.14–0.15), with one prompt. This run fills in 0.50–0.75 in 0.05 steps for three styles and tiles the result,…"
media: [{"src":"media/2026-10-27-k1-vace-strength-matrix/k1-grid.jpg","kind":"image","caption":"K1 matrix: strength 0.50–0.75 × 3 styles, seed 7; tiles labelled with depth MAE."},{"src":"media/2026-10-27-k1-vace-strength-matrix/k1-rain-s0.50.mp4","kind":"video","caption":"Style “rain”, strength 0.50, seed 7.","poster":"media/2026-10-27-k1-vace-strength-matrix/k1-rain-s0.50.poster.jpg"},{"src":"media/2026-10-27-k1-vace-strength-matrix/k1-rain-s0.75.mp4","kind":"video","caption":"Style “rain”, strength 0.75, seed 7.","poster":"media/2026-10-27-k1-vace-strength-matrix/k1-rain-s0.75.poster.jpg"},{"src":"media/2026-10-27-k1-vace-strength-matrix/k1-noon-s0.50.mp4","kind":"video","caption":"Style “noon”, strength 0.50, seed 7.","poster":"media/2026-10-27-k1-vace-strength-matrix/k1-noon-s0.50.poster.jpg"},{"src":"media/2026-10-27-k1-vace-strength-matrix/k1-noon-s0.75.mp4","kind":"video","caption":"Style “noon”, strength 0.75, seed 7.","poster":"media/2026-10-27-k1-vace-strength-matrix/k1-noon-s0.75.poster.jpg"},{"src":"media/2026-10-27-k1-vace-strength-matrix/k1-anime-s0.50.mp4","kind":"video","caption":"Style “anime”, strength 0.50, seed 7.","poster":"media/2026-10-27-k1-vace-strength-matrix/k1-anime-s0.50.poster.jpg"},{"src":"media/2026-10-27-k1-vace-strength-matrix/k1-anime-s0.75.mp4","kind":"video","caption":"Style “anime”, strength 0.75, seed 7.","poster":"media/2026-10-27-k1-vace-strength-matrix/k1-anime-s0.75.poster.jpg"}]
---

On 2026-10-23, depth adherence collapsed somewhere between VACE strength 0.8 (MAE ≈ 0.03) and
0.4 (MAE 0.14–0.15), with one prompt. This run fills in 0.50–0.75 in 0.05 steps for three
styles and tiles the result, labelling each tile with its adherence score.

## Setup

- **18 jobs:** strengths {0.50, 0.55, 0.60, 0.65, 0.70, 0.75} × 3 styles, all at seed 7. The
  prompts were:
  - **rain:** "cinematic film still, a woman in a red coat walks along a rainy street at dusk"
    (the M0 prompt);
  - **noon:** "sunny mediterranean alley at noon, a man in a white linen suit walks past
    whitewashed walls, film photography";
  - **anime:** "anime style illustration, a girl in a school uniform walks down a neon-lit Tokyo
    backstreet at night".
- **Pipeline:** jobs ran through `comfy-runner.py`, and every output passed V1. Each clip was
  scored with `depth-adherence.py` against Unity's depth pass (frames 0–16). Scoring took 11.8 s
  for all 18.
- **Tiling:** new `scripts/k1-tile.py` puts frame 8 of each clip in a style × strength grid and
  labels each tile with its MAE (`k1-grid.jpg`).

## Results: depth MAE (lower = closer to the blockout; ≤ 0.05 passed on 2026-10-23)

| Style | 0.50 | 0.55 | 0.60 | 0.65 | 0.70 | 0.75 |
| --- | --- | --- | --- | --- | --- | --- |
| rain | **0.126** (r 0.62) | 0.047 | 0.048 | 0.043 | 0.039 | 0.044 |
| noon | 0.054 | 0.047 | 0.046 | 0.038 | 0.039 | 0.036 |
| anime | 0.045 | 0.036 | 0.036 | 0.036 | 0.025 | 0.022 |

- **The collapse is a step, and its position depends on the prompt.**
  - **rain:** breaks between 0.50 and 0.55. At 0.50 the walking figure becomes a woman standing
    facing the camera, close up, and the street layout changes.
  - **noon and anime:** keep the layout at 0.50. Noon's MAE of 0.054 is just over the 0.05
    threshold.
- **Above the step, MAE falls slowly as strength rises,** from about 0.047 to 0.036 (noon) and
  0.045 to 0.022 (anime). The rain row is flat from 0.55 to 0.75 (0.039–0.048).
- **Style shifts the scale.** The anime row scores lowest at every strength. Flat-shaded
  illustration may be easier for DA3 to read, which would make this an estimator effect, not
  better adherence. Unverified.
- **The metric misses some visible changes again.**
  - At anime 0.50 the girl is larger and nearer the camera than the blockout figure, yet the
    tile scores 0.045, a pass.
  - Car colour, and the red banner that appears at anime ≥ 0.65, don't affect depth.
  - This repeats the 2026-10-23 finding that the metric misses small layout shifts.
- **Usable range for this scene:** 0.55–0.75. Lower strength gives more style freedom. 0.55
  passed for all three prompts with one seed. **One seed per cell:** the 0.50/0.55 step needs more
  seeds before it is used as a rule.

## Speed: models left in memory slow Wan 1.6×

- **The sweep:** in the same server session as batch 01 (Experiment 009), warm Wan runs took a
  median **79.8 s** (range 79.6–86 s; the first job was 110 s). On 2026-10-23 the same graph ran
  in 48.5 s.
- **Swap:** 11.8 GB in use afterwards.
- **Controlled rerun:** POST `/free` (unload models, free memory), then the same job. Cold first
  run 101.3 s, then two new seeds at **48.9 s and 49.6 s** warm. That is back to baseline.
- **Cause:** the 11 batch-01 models were still resident (SDXL Turbo, SAM 3.1, MoGe, Lotus and
  others), so memory swapped.
- **Fix:** `comfy-runner.py` now takes `"free_before": true` per job, which POSTs `/free` before
  submitting. The first K1 job has it set. The runner test suite still passes (10/10 `--quick`,
  plus the full run).
- An aside: identical prompts resubmitted are served from ComfyUI's cache in 0.1 s. Timing or
  repeat runs need a new seed, or `/free` first.

## Files

- Data: `raw/assets/experiments/2026-10-27-k1-vace-strength/`. Includes `adherence.json`
  (per-frame MAE / r), `cells.json`, the runner ledgers including the `/free` reruns, and
  `k1-grid.jpg`.
- Media (local): `media/2026-10-27_k1-vace-strength/` (18 clips + 5 reruns + grid).
