---
title: "Experiment 006 — TripoSplat silhouette adherence (M0 #3) and depth-adherence scores in K4 manifests"
date: "2026-10-23"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-23_0700, after Experiment 005. Local ComfyUI 0.38.2 (MPS, torch 2.12.1). Numbers come from the scripts' JSON output in the assets folder."
summary: "Method: - Parse the .spz with spz-check.py's parser. Keep the points with opacity ≥ 0.5 (99.7% here). - Project orthographically along an axis-aligned view, rasterise, then close and hole-fill. - Normalise both…"
media: [{"src":"media/2026-10-23-triposplat-silhouette-adherence/silhouettes.png","kind":"image","caption":"Ground-truth mask, splat silhouette and overlap, for both subjects.","thumb":"media/2026-10-23-triposplat-silhouette-adherence/silhouettes.thumb.jpg"},{"src":"media/2026-10-23-triposplat-silhouette-adherence/mannequin-crop-input.png","kind":"image","caption":"TripoSplat input: Unity mannequin crop."}]
---

## Goal

- The last M0 adherence check: TripoSplat image → Gaussian splat (M0 #3). Does the splat, seen
  from the input view, have the input subject's silhouette?
- Record Experiment 005's depth-adherence score inside the K4 manifest instead of as a separate
  file.

## 1. Silhouette check: `scripts/splat-silhouette.py`

**Method:**
- Parse the .spz with `spz-check.py`'s parser. Keep the points with opacity ≥ 0.5 (99.7% here).
- Project orthographically along an axis-aligned view, rasterise, then close and hole-fill.
- Normalise both silhouettes to their bounding box (centre, longest side → 256 px, aspect kept),
  then compute IoU.
- The reference mask is the input's subject mask: BiRefNet's cutout (M0 #2), or a crop of Unity's
  segmentation pass, which is exact.
- The view convention isn't documented, so it was **calibrated on one splat and then fixed**:
  - all 24 axis-aligned views were scored on the existing `example.png` splat (2026-10-06,
    262k points);
  - the best was `+x-y` (IoU 0.509; its mirror `-x-y` scored 0.448).
- That fixed view was then used for a second, new subject.

**Second subject:**
- The Unity mannequin from `beauty_00040.png`, cropped to 240×240 at (264,140) and upscaled to
  768×768 (`uc_mannequin_crop_00040.png`).
- Ground truth: the same crop of the segmentation pass (id `0xd925d6`).
- Runs through `comfy-runner.py`:
  - BiRefNet on both inputs: 6.8 s and 6.6 s.
  - TripoSplat spz-only, 262k points, seed 46: 353 s. `spz-check` passed.
- BiRefNet's mask on the crop vs the Unity segmentation: IoU **0.972** (same value as the
  full-frame result on 2026-10-06).

**Results: IoU at the fixed view `+x-y`**

| Splat | Mask | IoU |
| --- | --- | --- |
| mannequin | Unity segmentation (exact) | **0.516** |
| mannequin | BiRefNet mask of the same input | 0.507 |
| example | BiRefNet mask of example.png | 0.509 |
| mannequin | example.png mask (wrong subject) | 0.195 |
| example | mannequin mask (wrong subject) | 0.191 |
| mannequin, mirrored view `-x-y` | Unity segmentation | 0.201 |
| mannequin, side views `+z-y` / `-z-y` | Unity segmentation | 0.354 / 0.328 |

- In an all-views scan, the mannequin splat's best view was also `+x-y` (0.516). The convention
  calibrated on one subject held on the other.
- Threshold set to **IoU ≥ 0.45** after seeing these numbers. It separates matched pairs
  (0.507–0.516) from wrong subjects (0.19), mirrored (0.20) and side views (≤ 0.35). That is
  two subjects only, and the threshold is not pre-registered.

**Observations:**
- **The splat reproduces the pose well but IoU stays near 0.5** (`silhouettes.png`: GT,
  splat and overlap for both subjects). Thin limbs make IoU harsh: a few pixels of misregistration
  over a narrow leg removes most of its overlap. The orthographic projection also differs from the
  input image's perspective (feet and the arm span differ in scale).
- `example.png`'s BiRefNet mask includes the clouds behind the girl. TripoSplat also reconstructed
  the clouds, so the two agree: the check measures fidelity to the input, not
  subject-only segmentation.
- Next for this check:
  - a tolerance-based score (boundary F-score at a fixed pixel tolerance, or IoU after a fixed
    dilation), set before scoring;
  - a perspective projection with the model's camera, if TripoSplat exposes it;
  - more subjects.

## 2. Depth adherence recorded in K4 manifests

- `demo-manifest.py build --adherence R.json [--adherence-threshold 0.05]` matches each output to
  its `depth-adherence.py` result by file name, which carries the prompt_id.
- It writes `validation.adherence`: metric, estimator file and sha256, processing resolution,
  GT path and GT-frames sha256, mae, r, threshold and verdict.
- `validation.pass` is now V1 AND adherence. `v1_pass` is kept, and failures add a reason
  `adherence: depth-mae X > 0.05`.
- `depth-adherence.py` now writes `model_sha256` and `gt_frames_sha256` into its results.
- **Fix:** outputs filed into `media/` after a run are now located through `media/PATHMAP.tsv`.
  Before this, building a manifest after filing silently dropped every output.
- Built for Experiment 005's 15 runs:
  - 6 pass: s0.8 ×3 and shift96 ×3.
  - 9 fail on adherence: the strength-0.4 and 0.0 runs and the hflip runs. One of the s0.0 runs
    also fails V1 (frozen).
- Rescoring the filed files gave the same per-clip MAE as the first scoring (e.g. hflip seed 7
  0.0668), so the check is repeatable.
- `verify` on a new manifest: `static_ok: true`, no problems. `test_validate_output.py` still
  passes.

## Status against the M0 exit

- **All three M0 workflows now have an adherence check:**
  - #1 Wan: depth-MAE ≤ 0.05;
  - #2 BiRefNet: mask IoU ≥ 0.9 against Unity segmentation;
  - #3 TripoSplat: silhouette IoU ≥ 0.45 at view `+x-y`.
  - #1's verdict is stored in the manifest. #2's and #3's are still separate JSON files.
- **Still open for M0 exit:** E2 (diff against the browser's Save (API)).
- **Also open:** P1's comparison with comfy-cli and Manager.
