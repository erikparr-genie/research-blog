---
title: "Experiment 008 — PyTorch 2.15.0 (test index) on MPS: the batched linalg.inv silent failure is fixed, TripoSplat's preview works at 262k, Wan VACE 17f ~1.9× faster"
date: "2026-10-23"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-23_0700. A separate venv ($COMFY_INSTALL/torch215-venv, Python 3.12, torch 2.15.0 + torchvision 0.29.2 from download.pytorch.org/whl/test, then ComfyUI's requirements.txt minus torch/torchvision). The same ComfyUI 0.38.2 checkout and models, on port 8189, run while the Desktop-venv server (8188) was stopped. The Desktop venv was not changed."
summary: ""
media: [{"src":"media/2026-10-23-torch-2-15-mps-inv-and-wan/preview-strip.jpg","kind":"image","caption":"Orbit preview frames at four angles on torch 2.15.0: not black.","thumb":"media/2026-10-23-torch-2-15-mps-inv-and-wan/preview-strip.thumb.jpg"},{"src":"media/2026-10-23-torch-2-15-mps-inv-and-wan/triposplat-preview-262k.mp4","kind":"video","caption":"TripoSplat orbit preview at 262k on torch 2.15.0 (black or a crash on 2.12.1).","poster":"media/2026-10-23-torch-2-15-mps-inv-and-wan/triposplat-preview-262k.poster.jpg"},{"src":"media/2026-10-23-torch-2-15-mps-inv-and-wan/torch215-wan-s0.8-seed7.mp4","kind":"video","caption":"Wan VACE 17 frames on torch 2.15.0, strength 0.8, seed 7.","poster":"media/2026-10-23-torch-2-15-mps-inv-and-wan/torch215-wan-s0.8-seed7.poster.jpg"}]
---

## Why

- The 2026-10-23 sweep found PyTorch PR #195944 (in 2.15, on the `whl/test` index as of
  20 Oct). It inverts batched FP32 matrices up to 4×4 in a single Metal kernel.
- Our TripoSplat preview failure (2026-10-06) is exactly that case: RenderSplat calls
  `torch.linalg.inv` on one 3×3 covariance per splat (`comfy_extras/nodes_gaussian_splat.py`,
  FP32).
- The sweep marked "fixed for us" as unverified.

## 1. Standalone repro: `scripts/mps-inv-repro.py`

- N random SPD 3×3 matrices are inverted on MPS and compared against float64 CPU.
- Each N runs in its own child process, so an abort is recorded instead of ending the test.

| N | torch 2.12.1 (Desktop venv) | torch 2.15.0 (separate venv) |
| --- | --- | --- |
| 1,024 | ok (rel. err 4.9e-7), 297 ms | ok (4.2e-7), 183 ms |
| 16,384 | ok (7.7e-7), 4,469 ms | ok (7.7e-7), 121 ms |
| 65,344 | — | ok (1.1e-6), 65 ms |
| 65,536 | **all zeros**, no error, 4,461 ms | ok (1.1e-6), 64 ms |
| 131,072 | **all zeros**, no error, 10,567 ms | ok (1.1e-6), 65 ms |
| 262,144 | **process abort** (`Failed to allocate IOGPUDeviceShmem`, exit −6) | ok (1.1e-6), 66 ms |
| 1,048,576 | — | ok (1.5e-6), 85 ms |

- 2.12.1 reproduces the 2026-10-06 finding exactly.
- 2.15.0 is correct up to 1M matrices and about 160× faster at 131k.
- FP16 on 2.15.0 raises `NotImplementedError: linalg.inv: Low precision dtypes not supported`. It
  fails loudly, not silently. RenderSplat uses FP32.

## 2. TripoSplat with its orbit preview (the full template), 262,144 splats

- Job `torch215-triposplat-preview-262k`: `example.png`, seed 46, render 1024², 75 frames. This is
  the 2026-10-06 configuration that aborted the process on 2.12.1.
- **Passed V1:** .spz 262,144 points; preview 75 frames 1024×1024, decoded. The frames show the
  character at four orbit angles, not black (`preview-strip.jpg`).
- Run time 374.9 s, with sampling at about 15–17 s/step. On 2.12.1 the spz-only workflow took
  367 s (2026-10-06).
- The splat is **not** content-identical to the 2.12.1 splat with the same seed
  (`ca1e3511…` vs `31893869…`). That is expected after a torch change.
- Silhouette adherence (Experiment 006 method, view `+x-y`, BiRefNet mask of example.png):
  **IoU 0.512**, pass. The 2.12.1 splat scored 0.509.

## 3. Wan VACE 1.3B 17f (M0 #1), strength 0.8, seeds 7–12

| | torch 2.12.1 | torch 2.15.0 |
| --- | --- | --- |
| Warm execution time | median 48.5 s (2026-10-06, n=5); today's uncontended runs 48.2–51 s | **median 25.0 s** (24.6–25.5, n=5); first run with model load 55.2 s |
| V1 | pass | 6/6 pass |
| Depth-adherence MAE (DA3 small) | seeds 7/8/9: 0.0363 / 0.0394 / 0.0366 | seeds 7/8/9: 0.0358 / 0.0394 / 0.0368; seeds 10/11/12: 0.0282 / 0.0356 / 0.0339 |
| Pixels identical to 2.12.1 at the same seed? | — | No (content hashes differ) |

- About **1.9× faster** on warm runs, with unchanged structural adherence (all ≤ 0.05).
- Not separated yet: what makes it faster, and whether the differences in Python (3.12 vs 3.13),
  `av` (19.0.2 vs 18.0.0) or numpy contribute. The sampler dominates the time, so a torch-side
  change (attention/matmul kernels) is the likely cause; that is an inference.

## Caveats

- torch 2.15.0 came from the **test** index (release candidate per the sweep). A separate venv
  is not the Desktop install, so Comfy Desktop's own update path is untested.
- The 2.15 requirements also bring a floor of macOS 15 and Python 3.11. This machine runs macOS
  26.5.1, and the Desktop venv uses Python 3.13, so both are fine.
- One TripoSplat run and 6 Wan runs. LTX (#15804) was not tested; its models aren't on disk.

## Implications

- The TripoSplat MPS preview bug is a torch ≤ 2.14 issue. "#3 needs the preview branch removed"
  becomes "needed only on torch < 2.15".
- For local Wan generation, torch 2.15 roughly halves wall time. That argues for moving the M0/M1
  baseline to 2.15 once it is final, re-baselining V1's size thresholds and recording torch in
  the manifest (already in the env lock).
- The Desktop venv was left untouched (torch 2.12.1). The 2.15 venv is 1.9 GB at
  `$COMFY_INSTALL/torch215-venv`.
