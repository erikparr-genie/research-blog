---
title: "Experiment 005 — Wan VACE depth-adherence check (Depth Anything 3 vs Unity depth) and the first scripted model download (P1)"
date: "2026-10-23"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-23_0700. Local ComfyUI 0.38.2 (MPS, torch 2.12.1) started for the run. Numbers come from the scripts' JSON output in the assets folder."
summary: "Two of the three open M0 exit items in docs/research-plans/2026-09-24-automated-comfy-demoing.md: - P1: provision a model with a script, with checksum, resume and a disk budget. All earlier M0 models were already on…"
media: [{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/contact-frame8.jpg","kind":"image","caption":"Frame 8: ground-truth depth, beauty, and four conditions side by side.","thumb":"media/2026-10-23-wan-depth-adherence-and-p1-download/contact-frame8.thumb.jpg"},{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-s0.8-seed7.mp4","kind":"video","caption":"Control strength 0.8, seed 7.","poster":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-s0.8-seed7.poster.jpg"},{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-s0.4-seed7.mp4","kind":"video","caption":"Control strength 0.4, seed 7: structure lost at half strength.","poster":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-s0.4-seed7.poster.jpg"},{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-s0.0-seed7.mp4","kind":"video","caption":"Control strength 0.0, seed 7.","poster":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-s0.0-seed7.poster.jpg"},{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-hflip-seed7.mp4","kind":"video","caption":"Horizontally flipped depth control, seed 7.","poster":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-hflip-seed7.poster.jpg"},{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-shift96-seed7.mp4","kind":"video","caption":"Depth control shifted 96 px, seed 7.","poster":"media/2026-10-23-wan-depth-adherence-and-p1-download/adh-shift96-seed7.poster.jpg"},{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/control-depth-hflip.mp4","kind":"video","caption":"Perturbed control: the flipped depth video.","poster":"media/2026-10-23-wan-depth-adherence-and-p1-download/control-depth-hflip.poster.jpg"},{"src":"media/2026-10-23-wan-depth-adherence-and-p1-download/control-depth-shift96.mp4","kind":"video","caption":"Perturbed control: the depth video shifted 96 px.","poster":"media/2026-10-23-wan-depth-adherence-and-p1-download/control-depth-shift96.poster.jpg"}]
---

## Goal

Two of the three open M0 exit items in `docs/research-plans/2026-09-24-automated-comfy-demoing.md`:
- **P1:** provision a model with a script, with checksum, resume and a disk budget. All earlier
  M0 models were already on disk.
- **Adherence check for M0 #1 (Wan VACE 1.3B).** Re-estimate depth on the generated video and
  compare it with the Unity depth pass that conditioned it. Then check that the score separates
  good outputs from outputs with known structural errors (the U1 "controlled test", on one scene).

The two are linked: the depth estimator used for the check was the model downloaded for P1.

## 1. P1: `scripts/fetch-model.py`

- Source: Comfy-Org's Depth Anything 3 repack, the files the templates
  `utility_depth_anything3_{image,video}_depth_estimation` declare
  (`huggingface.co/Comfy-Org/Depth-Anything-3`, folder `geometry_estimation/`). Before this run the
  `geometry_estimation` folder was empty, so the DA3 and MoGe nodes had no model.
- The expected size and sha256 come from the HF tree API (`lfs.oid`) before any byte is
  downloaded. The download goes to `.part` with HTTP Range resume. The file is renamed into place
  only after the hash matches. The script refuses if the file is over `--max-gb` (default 30) or
  would leave less than `--min-free-gb` (default 100) free.

Measured (ledger: `fetch-ledger.jsonl`):

| Case | Result |
| --- | --- |
| `depth_anything_3_small` (137,254,980 B), stopped deliberately after 40.9 MB | `interrupted`, `.part` kept |
| Same command again | resumed at byte 40,894,464 (HTTP 206), sha256 matched, `ok` in 6.2 s total |
| Same command a third time | `present` (hash re-verified, nothing downloaded), 0.4 s |
| `depth_anything_3_mono_large` (1,336,748,056 B) with `--max-gb 1` | `refused` before download |
| Gated repo (`black-forest-labs/FLUX.1-dev`, not accepted on this machine) | `gated` (HTTP 401 on the file). The tree API still lists the size and hash, so metadata does not reveal whether a repo is gated. |
| 40 MB of random bytes planted as `.part`, then resumed | `checksum-mismatch`, renamed to `.part.bad`, exit 1 |
| `depth_anything_3_mono_large`, full | `ok`, 66.9 s, 20.0 MB/s, sha256 matched |

- Disk: +1.47 GB in `$COMFY_MODELS/geometry_estimation/`. Free space was 737 GB before.
- Not compared yet: comfy-cli `model download` and ComfyUI-Manager on the same files (P1 asks for
  all three).

## 2. Depth-adherence check: `scripts/depth-adherence.py`

**Method.** The script runs under ComfyUI's venv and reuses ComfyUI's own DA3 code (`_run_da3`
from `comfy_extras/nodes_depth_anything_3.py`, processing resolution 504) outside the server.
That keeps float depth instead of the 8-bit, normalised PNG that the `DA3Render` → SaveImage path
would give.
- **Ground truth:** Unity's depth pass `UnityComfy/Captures/demo_street/depth/depth_%05d.png`,
  inverse mapping `(1/z − 1/far)/(1/near − 1/far)`, which is affine in disparity. Pixels at 0
  (beyond far / background) are excluded; 91.8% of pixels are valid.
- **Estimate:** DA3 depth D → disparity 1/D, then a per-frame least-squares scale and shift onto
  the GT values.
- **Score:** mean absolute error over valid pixels, in control units (0–1 = the shot's near–far
  range), averaged over the 17 frames. Pearson r is also recorded.
- **Speed:** about 1.2–2 s per 17-frame clip on MPS after the model loads.

**Inputs scored** (all 832×480, 17 frames, same prompt):
- Unity's own renders (beauty, clay). Here the GT is exact, so the score measures the estimator's
  own error.
- 35 existing nominal Wan outputs (VACE strength 0.8): 30 seeds from 2026-10-02 and 5 from
  2026-10-06.
- 15 new Wan runs through `scripts/comfy-runner.py`, with known perturbations, seeds 7/8/9 each:
  - strength 0.8, 0.4 and 0.0;
  - the control video flipped horizontally (`hflip`);
  - the control shifted right by 96 px, black-padded (`shift96`).
  - The workflow is the M0 #1 graph with VACE `strength` exposed as `{{strength}}`.
- Wrong-GT negatives: every nominal clip scored against flipped GT, and against GT frames 40–56
  instead of 0–16.

**Results: mean MAE (min–max)**

| Input | DA3 small | DA3 mono_large |
| --- | --- | --- |
| Unity beauty (estimator floor) | 0.0216 | 0.0423 |
| Unity clay | 0.0448 | 0.0581 |
| Wan nominal s0.8, 35 clips | 0.029–0.031 mean (0.0207–0.0419) | 0.044 mean (0.0342–0.0559) |
| Wan s0.8, new seeds 7–9 | 0.0374 (0.0363–0.0394) | 0.0499 |
| Wan s0.4 | **0.1378** (0.1261–0.1443) | 0.1581 |
| Wan s0.0 (prompt only) | **0.1541** (0.1363–0.1694) | 0.1684 |
| Wan with hflipped control | **0.0677** (0.0614–0.0748) | 0.0758 |
| Wan with control shifted 96 px | 0.0436 (0.0407–0.0462) | 0.0557 |
| Nominal clips vs hflipped GT | 0.067–0.070 (0.0520–0.0922) | 0.077–0.079 |
| Nominal clips vs GT frames 40–56 | 0.056–0.060 (0.0416–0.0797) | 0.073–0.074 |

**With a threshold of MAE ≤ 0.05 (DA3 small):**
- Pass: 35/35 nominal clips, 3/3 new s0.8 clips, and Unity beauty and clay.
- Fail: 0/3 pass for each of s0.4, s0.0 and hflip.
- Wrong-GT negatives: 0/35 pass against hflipped GT, but 7/35 pass against the time-shifted GT.
- **Misses:** 3/3 shift96 clips pass, as do the 7 time-shift cases.

Observations:
- **DA3 small is the better judge here, not mono_large.** It has half the floor on Unity beauty
  (0.022 vs 0.042) and a wider gap between good and bad outputs. Loading small logs six missing
  `output_conv2_aux` head weights; the main depth head is unaffected.
- **Generated video scores better than Unity's clay render** (0.029 vs 0.045). The estimator is
  less accurate on untextured grey geometry. Beauty frames are the right calibration input.
- **Structure collapses between strength 0.8 and 0.4** with this setup (CausVid LoRA, 4 steps,
  uni_pc). At 0.4 the output is a different street (`contact-frame8.jpg`), and the score is
  almost as bad as having no control. It is a step, not a gradual slope. A finer sweep is needed
  before calling it a threshold.
- **What the metric misses:** a 96 px (\~12%) horizontal shift of the control is barely
  detectable (+0.006 over nominal). The scene is a street corridor that looks much the same when
  shifted, and per-frame scale/shift alignment absorbs part of the change. Frames 40–56 of the same
  shot also look similar. The metric catches large layout errors (wrong structure, mirrored
  layout), not small misplacements. Small misplacements need edge or object-level checks (U1's
  edge F1 / keypoint terms).
- **The V1 sanity checks rejected 1 of the 15 runs, and the runner exited 1:** `adh-s0.0-seed9`
  failed as `frozen: got 5, expected static run <= 4 frames`. It is the prompt-only run, which
  produced a nearly static shot. The rejection is correct by V1's definition, and it is the first V1
  rejection of a real (not injected) output in a run that had no MPS failure.
- **Timing:** Wan 17f median 61.5 s here (48.2–132.4 s), slower than the 48.5 s median of
  2026-10-06 because DA3 scoring ran on the same GPU at the same time. The first run includes model
  load.

**Limits (honest):**
- One scene only. The threshold 0.05 was chosen and tested on the same scene, so it is not a
  held-out result as U1 requires.
- No human labels, and no VLM judge comparison yet.
- The prompt asked for "a woman in a red coat… at dusk". Nominal outputs follow the layout but not
  the red coat. This check measures structure, not prompt adherence.

## Status against the M0 exit

- **P1:** done for one model family, with the resume, refuse, gated and corruption paths
  exercised. Comparison with comfy-cli and Manager is still open.
- **Adherence check for #1 (Wan):** done. `depth-adherence.py`, DA3 small, MAE ≤ 0.05. It separates
  correct outputs from the clearly wrong ones on this scene. It is not yet wired into the runner
  or the manifest; it runs as a separate step.
- **Still open for M0 exit:** adherence check for #3 (TripoSplat), and E2 (browser Save (API)
  diff).
