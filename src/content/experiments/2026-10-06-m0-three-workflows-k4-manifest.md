---
title: "Experiment 004 — M0 on ComfyUI 0.38.2: three workflows, K4 manifests, runner restart/stall/pre-flight, and an MPS silent failure in TripoSplat"
date: "2026-10-06"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-06_0700. Local ComfyUI 0.38.2 (MPS) started for the run; numbers from the scripts' JSON output and the ComfyUI server log."
summary: "Continue M0 in docs/research-plans/2026-09-24-automated-comfy-demoing.md: - K4 (manifest), trying comfy build init first; - choose M0 workflows 2 and 3 and run D2/D3/E2 on them; - the E1 gaps: stall timeout, a real…"
media: [{"src":"media/2026-10-06-m0-three-workflows-k4-manifest/m0-wan-vace-17f.mp4","kind":"video","caption":"M0 workflow 1: Wan VACE, 17 frames.","poster":"media/2026-10-06-m0-three-workflows-k4-manifest/m0-wan-vace-17f.poster.jpg"},{"src":"media/2026-10-06-m0-three-workflows-k4-manifest/m0-birefnet-cutout.png","kind":"image","caption":"M0 workflow 2: BiRefNet cutout of a Unity frame (IoU 0.972 against Unity’s segmentation pass)."},{"src":"media/2026-10-06-m0-three-workflows-k4-manifest/triposplat-131k-black-preview.mp4","kind":"video","caption":"The MPS silent failure: TripoSplat’s orbit preview reported success and saved a fully black video.","poster":"media/2026-10-06-m0-three-workflows-k4-manifest/triposplat-131k-black-preview.poster.jpg"},{"src":"media/2026-10-06-m0-three-workflows-k4-manifest/triposplat-262k-preview.png","kind":"image","caption":"Point preview of the 262k splat. The input was ComfyUI’s stock example.png placeholder: a plumbing test, not a chosen subject."},{"src":"media/2026-10-06-m0-three-workflows-k4-manifest/repeat-0.38.2-r00.mp4","kind":"video","caption":"Wan VACE re-check after the ComfyUI 0.38.2 update (5/5 valid): run r00.","poster":"media/2026-10-06-m0-three-workflows-k4-manifest/repeat-0.38.2-r00.poster.jpg"}]
---

## Goal

Continue M0 in `docs/research-plans/2026-09-24-automated-comfy-demoing.md`:
- K4 (manifest), trying `comfy build init` first;
- choose M0 workflows 2 and 3 and run D2/D3/E2 on them;
- the E1 gaps: stall timeout, a real ComfyUI restart mid-job, and the L0 pre-flight test.

## 0. The install changed under us

- The local install is now **ComfyUI 0.38.2** (git tag v0.38.2), with workflow templates **0.11.74**
  (`comfyui_workflow_templates_json` 0.1.100) and frontend 1.53.6. On 2026-10-02 it was 0.35.0 /
  0.11.57.
- The template packages' dist-info timestamps are 2026-10-05 09:42. The Comfy Desktop app's
  state was written at 09:41 the same day, so the upgrade came through Comfy Desktop. Whether it
  was manual or an auto-update is unknown.
- Consequence: the rev 4 "pinned to 0.35.0" no longer holds. Everything below was measured on
  0.38.2.
- Unchanged: torch 2.12.1, Python 3.13.12, macOS arm64 (M5 Pro, 48 GB).

## 1. Regression: Wan VACE 1.3B on 0.38.2

`scripts/v1-repeat-runs.py`, same workflow and settings as Experiment 003: 17 frames, 832×480 at
16 fps, Unity depth control, random seeds. Data: `v1-wan17-5runs-0.38.2.jsonl`.

- **5/5 executed and 5/5 passed V1.**
- Execution time: 113.9 s cold; warm 48.3–49.4 s, median 48.5 s. On 0.35.0 the warm median
  was 50.0 s.
- Bits per pixel 0.26–0.45 (median 0.29). On 0.35.0 the median was 0.30.
- No regression is visible at n=5.

## 2. K4: `comfy build init` and the demo manifest

- **comfy-cli 1.22.0** was installed in its own venv (`$COMFY_INSTALL/cli-venv`) and
  tracking was disabled.
- The command:
  `comfy build init <install> --models-dir $COMFY_MODELS --python <install>/.venv/bin/python`.
  - It worked **without sign-in** and took 8.0 s.
  - It read the version (v0.38.2) from the running server.
  - It recorded 9 model files (19.8 GB), each with sha256 and size, plus the full pip freeze
    (comfy-kitchen, comfy-aimdo, template packages, torch…). No custom nodes were present.
- **The sha256 values are real.** I checked one (`wan_2.1_vae.safetensors`) with `shasum`, and
  it matched.
  - 19.8 GB in 8 s suggests they are cached or very fast hashes. This was not investigated.
- Our models live outside the install, so `--models-dir` is required. Without it the scan would
  have looked under the install's own `models/`.
- `scripts/demo-manifest.py`:
  - `env` saves the comfy-cli JSON envelope as the environment lock
    (`env-lock-0.38.2.json`, 6 KB).
  - `build` writes one manifest per runner attempt (schema `unity-comfy/demo-manifest/0`):
    - the exact submitted prompt, embedded, with its sha256;
    - the workflow source hash and params;
    - input files with sha256;
    - every model named in the prompt, resolved to sha256 and size through the lock;
    - versions;
    - outputs, with both file sha256 and a **content** sha256 (decoded RGBA pixels, or the
      gunzipped splat);
    - V1 results and rejection reasons;
    - `license: null` (D4) and `cost: local, 0 credits`.
- The runner now writes the submitted prompt to `LEDGER.prompts/<prompt_id>.json` before the POST.
- **7 manifests were built** from this run's ledger.
  - All 5 + 4 + 1 model references resolved (unresolved = 0).
  - The rejected TripoSplat run (§4) carries its V1 rejection reasons. This completes the
    "rejection reason recorded in the manifest" half of the M0 silent-failure criterion.
- **`verify`:**
  - The static check (input and model hashes, ComfyUI version) passes on the current install.
  - A copy of a manifest with one altered model hash is flagged ("model birefnet.safetensors:
    missing or different hash").
- **Re-run from the manifest alone** (`verify --rerun`): see §6.
- **File bytes never match between runs.** SaveImage and SaveVideo embed the prompt, which
  includes the per-attempt `filename_prefix`, as metadata. Reproducibility therefore has to be
  judged on content hashes.

## 3. Inventory on 0.38.2 and the choice of M0 workflows 2 and 3

`scripts/comfy-inventory.py` against the live install. Model sizes were not re-fetched.

- 590 template entries.
  - 348 contain a partner (API) node.
  - 244 declare model metadata.
  - 368 model URLs / 337 filenames.
- Local size buckets: <12 GB 59, 12–24 68, 24–36 50, >36 63. 127 fp8 templates.
- Nodes: 970; API nodes 280; output nodes 70; with `price_badge` 831.
- Node types missing from `/object_info`: AILab_QwenVL, ImageRemoveAlpha+.
  - In 0.35 there were 4 missing: TripoRefineNode and GetImageSizeAndCount now exist.
- **Templates with all declared models present: `utility_birefnet_remove_background` and
  `3d_triposplat_image_to_gaussian_splat`.** Their models were already in ComfyUI-Shared (since
  2026-09-01), so no download was needed. Both are non-fp8 and well under 12 GB.
- **Chosen:**
  - **#2 = BiRefNet background removal** (image; 424 MB model);
  - **#3 = TripoSplat image → Gaussian splat** (local 3D; 5 models, 3.8 GB).
  - This follows the rev 4 recommendation: "local, until a credit cap is approved".

## 4. D3 (MPS) and E2 (conversion) for #2 and #3

**E2: conversion** with `comfy run --workflow <template> --print-prompt` (comfy-cli 1.22, client
side; outputs archived in `workflows/m0/*.cli-converted.json`).

What the converter did:
- Flattened subgraphs to `outer:inner` ids, nested where needed (`88:85:81`).
- Dropped the template's bypassed nodes (mode 4): SplatToMesh, the GLB SaveGLB, and a subgraph
  PreviewImage.
- Flattened the dynamic combo to `mode.yaw` / `mode.pitch` / `mode.distance` keys.

Checks:
- `comfy workflow validate`: both are valid, 0 errors.
- TripoSplat gets 2 warnings: InvertMask/JoinImageWithAlpha inside the BiRefNet subgraph reach
  no output, so the server prunes them.
  - That matches the template: only the mask output of that subgraph is used.
- **Not done:** a diff against the frontend's Save (API). It needs a browser session.

Edits needed for unattended capture:
- The BiRefNet template only *previews* (PreviewImage and MaskPreview write `type: temp`, which
  the runner ignores by design). I replaced PreviewImage with SaveImage and dropped MaskPreview.
- Placeholders for image, seed, `num_gaussians` and render size were added in
  `workflows/m0/*_api.json`.

**#2 BiRefNet on a Unity frame (D3 passes):**
- Input: the beauty pass, `demo_street` frame 40 (832×480, mannequin in a street).
- Passed V1 in 10.4 s.
- **Adherence check against Unity ground truth** (`scripts/mask-iou.py`): the output alpha is
  scored against the segmentation pass of the same frame.
  - **IoU 0.972, precision 0.973, recall 0.999** (5,749 vs 5,602 px). The threshold of 0.9 was
    set before scoring.
  - Control: scored against frame 10 (subject elsewhere), IoU is 0.0. That only shows the check
    isn't vacuous; it's a weak control.

**#3 TripoSplat (D3 fails as published; it passes without the preview branch):**

| Run | num_gaussians | Preview render | Result |
| --- | --- | --- | --- |
| template default | 262,144 | 1024², 75 frames | **ComfyUI process aborted** in RenderSplat: `Assertion failed: "Failed to allocate IOGPUDeviceShmem"`, `Fatal Python error: Aborted` (`nodes_gaussian_splat.py:721`, `torch.linalg.inv`). The .spz had already been saved. |
| smaller render | 262,144 | 512², 75 | Same abort. Resolution isn't the cause. |
| fewer splats | 131,072 | 1024², 75 | **Silent failure.** Status `success` in 378.3 s and an mp4 was saved, but all 75 frames are pure black (RGB 0, not even the grey background). **V1 rejected it**: black, flat, frozen. |
| fewer still | 32,768 | 1024², 75 | `RuntimeError` in VAEDecodeTripoSplat ("cannot reshape tensor of 0 elements"). The decoder needs about the octree density. |
| **preview removed** | 262,144 | none | **Passed**: 367.1 s. The .spz (v2, 262,144 points) passes `scripts/spz-check.py`. |

Sampling was about 17 s/step × 20 steps on MPS.

**Root cause, reproduced outside ComfyUI** (torch 2.12.1, MPS, random SPD 3×3 batches against
CPU):
- `torch.linalg.inv` on N×3×3 is correct for N = 1,024 and 16,384 (max relative error 3.4e-6).
- For **N = 65,536 and 131,072 it returns all-zero matrices without raising**.
- At **N = 262,144 it aborts the process**.
- The boundary is about 65.3k (≈2¹⁶). A bisection flickered between 65,343 and 65,344, so it
  is not exactly deterministic.
- RenderSplat inverts one covariance per splat, so any TripoSplat preview at the template's
  density is either black or a crash on this Mac.

**What we did about it:**
- `scripts/spz-check.py` checks the splat file itself:
  - header and version, point count, non-zero positions, non-degenerate bounding box,
    non-constant colour and alpha;
  - an optional CPU point preview.
- A point preview of the default run shows recognisable parts of the input drawing (pink dress,
  white outstretched arms, yellow hair, blue eye). The preview's axis convention is unverified.
- The runner applies `spz-check` to .spz outputs. Under system python (no numpy) only the header
  checks run.

## 5. E1 runner: stall timeout, real restart, pre-flight

`scripts/test_comfy_runner.py` on 0.38.2: **13/13 as expected** (`runner-tests-0.38.2.json`).
That is the 9 earlier cases plus 4 new ones:
- **stall-cancels:** a /ws listener (stdlib RFC 6455 reader) records the last event per
  prompt. A Wan job with `stall_timeout` 3 s was cancelled as `stalled`, and the server status
  became `cancelled`.
  - This tests the mechanism, not a real hang: Wan emits one progress event per \~5.5 s step.
  - The default stall timeout is 300 s.
- **ws-sees-events:** the listener receives events for a normal job.
- **preflight-missing-model:** a Wan prompt with a non-existent `unet_name` is `refused`
  before submission, and the server's job count is unchanged (11 → 11).
- **preflight-missing-node:** an unknown node type (AILab_QwenVL) is `refused`. This is the
  M0 pre-flight failure test.

`scripts/test_comfy_restart.py`, a **real ComfyUI kill -9 mid-job** (`restart-test.json`):
- The server was killed 12.3 s into a Wan job and restarted; it was up again after 4.6 s.
- The runner kept polling through the outage.
- Attempt 0 → `error`, retryable, with detail "lost: server has no record of this submitted
  local job and no outputs exist".
- Attempt 1 (allowed by `--max-retries 1`) passed in 98.5 s, with **exactly one output file**.
- **Natural restart (TripoSplat aborts above):** the job had already saved its .spz, so the
  runner did *not* call it lost. It ended `unknown-outcome` with detail "1 output file(s)
  exist, so it ran at least partly (crash mid-job?)".
  - This is the intended conservative behaviour: partial output, no blind resubmission.

## 6. Re-run from the manifest alone

`demo-manifest.py verify --rerun` resubmits the embedded prompt through the runner and compares.
Results: see the `*.verify.json` files. Summary is in the results section below.

| Workflow | Static check | Re-run verdict | Content identical to the original |
| --- | --- | --- | --- |
| #1 Wan VACE 1.3B, 17 f, seed 7 | ok | passed (same verdict) | **yes**: decoded pixels identical |
| #2 BiRefNet on Unity frame 40 | ok | passed | **yes** |
| #3 TripoSplat .spz, seed 46 | ok | passed | **yes**: gunzipped splat payload identical |

- Each replay was run twice: once before and once after the switch from file hashes to content
  hashes. Both rounds matched.
- The file sha256 differed every time because of the embedded metadata.
- So on this machine and install, a manifest alone reproduces all three M0 outputs exactly.
- Cross-machine or cross-version reproduction (E6) is untested.

## Not done / caveats

- E2 against the frontend's Save (API): needs a browser.
- D2 for #3: the 5 models are resolved and hashed; widget-chosen LoRAs don't apply.
- The partner spend ledger, as before: API nodes are still refused.
- The adherence check exists only for #2 (mask IoU). #1 (Wan) still has no adherence check;
  V2/U1 are needed.
- The TripoSplat preview can't run on MPS here. The SPZ check and point preview stand in for it.
- n=5 for the 0.38.2 regression.
- Unity was not used this run. All Unity inputs are existing captures.
