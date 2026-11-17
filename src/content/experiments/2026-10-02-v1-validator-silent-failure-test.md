---
title: "Experiment 003 — V1 output validator, silent-failure exit test, Wan VACE 30-run baseline, and the M0 runner"
date: "2026-10-02"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-02_1430. Scripts run against local ComfyUI 0.35.0 (MPS) started for the run; numbers from the scripts' JSON output."
summary: "Work through M0 items V1 (cheap sanity checks), the M0 silent-failure exit test and E1 (runner acceptance criteria) from docs/research-plans/2026-09-24-automated-comfy-demoing.md."
media: [{"src":"media/2026-10-02-v1-validator-silent-failure-test/sft-control.mp4","kind":"video","caption":"Silent-failure test, control clip (untouched): passed.","poster":"media/2026-10-02-v1-validator-silent-failure-test/sft-control.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/sft-black.mp4","kind":"video","caption":"Deliberately broken output, black: ran with no error in ComfyUI, rejected by the validator.","poster":"media/2026-10-02-v1-validator-silent-failure-test/sft-black.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/sft-flat-grey.mp4","kind":"video","caption":"Deliberately broken output, flat grey: rejected.","poster":"media/2026-10-02-v1-validator-silent-failure-test/sft-flat-grey.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/sft-frozen.mp4","kind":"video","caption":"Deliberately broken output, frozen: rejected.","poster":"media/2026-10-02-v1-validator-silent-failure-test/sft-frozen.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/sft-frozen-tail.mp4","kind":"video","caption":"Deliberately broken output, frozen tail: rejected.","poster":"media/2026-10-02-v1-validator-silent-failure-test/sft-frozen-tail.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/sft-truncated.mp4","kind":"video","caption":"Deliberately broken output, truncated: rejected.","poster":"media/2026-10-02-v1-validator-silent-failure-test/sft-truncated.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/repeat-r00.mp4","kind":"video","caption":"Wan VACE repeat runs (30 seeds × 17 frames, 30/30 valid): run r00.","poster":"media/2026-10-02-v1-validator-silent-failure-test/repeat-r00.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/repeat-r01.mp4","kind":"video","caption":"Repeat run r01.","poster":"media/2026-10-02-v1-validator-silent-failure-test/repeat-r01.poster.jpg"},{"src":"media/2026-10-02-v1-validator-silent-failure-test/repeat-r02.mp4","kind":"video","caption":"Repeat run r02.","poster":"media/2026-10-02-v1-validator-silent-failure-test/repeat-r02.poster.jpg"}]
---

## Goal

Work through M0 items V1 (cheap sanity checks), the M0 **silent-failure exit test** and E1 (runner
acceptance criteria) from `docs/research-plans/2026-09-24-automated-comfy-demoing.md`.

## Setup

- Apple M5 Pro, 48 GB. ComfyUI 0.35.0, templates 0.11.57, MPS. Started with the Comfy Desktop
  extra-model-paths config.
- `scripts/validate-output.py` uses only the standard library plus ffmpeg/ffprobe. Frames are
  downscaled to 96 px wide, 8-bit luma.
  - **black** frame: mean < 10 and std < 6.
  - **flat** frame: std < 3.
  - **static pair**: mean abs diff < 0.5.
  - **frozen**: longest static run > 25% of frames (minimum 2).
  - Expected frame count, size and fps are checked when given.
  - Defaults allow 0 black and 0 flat frames.

## 1. Calibration on existing files

All existing generated clips passed:

| File | Frames | Min luma std | Min / median inter-frame MAD |
| --- | --- | --- | --- |
| demo_street_wan_vace (81f) | 81 | 56.9 | 2.70 / 6.03 |
| quicktest_17f_wan_vace | 17 | 60.4 | 1.96 / 4.02 |

The Unity passes also passed: beauty, clay, depth, normal and segmentation (clay min MAD 0.43, but
no long static run). The **pose pass was rejected**: 4 black frames, plus a 35-frame static run.
It is a mostly black skeleton render, not natural video. The validator is for generated outputs,
not control passes.

## 2. Silent-failure exit test (`scripts/silent-failure-test.py`)

A real Wan VACE clip goes through core-node workflows: LoadVideo → corruption → CreateVideo →
SaveVideo. Every job reports `status_str: success` and saves exactly one mp4.

| Case | How it's corrupted | 81f source | 17f source |
| --- | --- | --- | --- |
| control | untouched | PASS | PASS |
| black | ImageBlend multiply with EmptyImage(0) | REJECT: black, flat, frozen | REJECT (same) |
| flat_grey | ImageBlend normal with EmptyImage(0x808080) | REJECT: flat, frozen | REJECT |
| frozen | ImageFromBatch(0,1) → RepeatImageBatch(n) | REJECT: frozen (run 81) | REJECT (run 17) |
| frozen_tail | first half + last frame repeated | REJECT: frozen (run 42) | REJECT (run 10) |
| truncated | ImageFromBatch(0, n/2) | REJECT: frame_count 40 vs 81 | REJECT 8 vs 17 |

The result is 12/12 as expected. Every corrupted output passed the execution layer and was caught
only by output validation. That is the M0 silent-failure criterion. The **manifest** part of the
criterion (recording the rejection reason in a K4 manifest) is not done, because K4 doesn't exist
yet. The reasons are in the runner ledger and the JSON.

Self-test on synthetic ffmpeg clips (`scripts/test_validate_output.py`): 7/7 cases as expected
(moving, black, grey, frozen, black tail, truncated, undecodable file).

**Known blind spots, by design of the thresholds:**
- a frozen stretch ≤ 25% of the clip (for example ≤ 20 of 81 frames);
- fades to black (any black frame rejects; needs tuning on real content);
- NaN can't be injected with core nodes. Its observed symptom (black output, #15804) is covered.
- wrong-but-plausible content, for example a wrong checkpoint (see [[id-v2v]]).

## 3. V1 baseline: Wan VACE 1.3B, 30 runs (`scripts/v1-repeat-runs.py`)

Settings: `wan21_vace_1.3B_depth_api.json` (CausVid 0.7, 4 steps, uni_pc, strength 0.8), Unity
depth control, 17 frames, 832×480 at 16 fps, 30 random seeds, run sequentially.

- **30/30 executed successfully, and 30/30 passed V1. Zero silent failures observed** on this
  machine and workflow. With 0/30, the 95% upper bound on the failure rate is about 10% (rule of
  three). That tells us nothing about LTX (#15804's model), fp8, or 81-frame runs.
- Execution time:
  - first run 112.5 s (includes model loading);
  - runs 2–30: median 50.0 s, range 49.0–70.3 s (about 5.8 s per step for sampling).
- Output statistics, min / median / max:
  - luma mean 47.1 / 66.7 / 89.2;
  - min frame std 39.8 / 49.9 / 67.2;
  - min inter-frame MAD 1.03 / 2.13 / 2.92;
  - bits per pixel 0.21 / 0.30 / 0.48.
- Margins:
  - the lowest real MAD (1.03) is 2× the static threshold (0.5);
  - the lowest real frame std (39.8) is 13× the flat threshold (3);
  - injected failures sit at MAD ≤ 0.05 and std 0.
  - File size alone would also separate them: black/grey clips came in at 0.003–0.006 bpp, versus ≥ 0.21 for real outputs.

## 4. M0 runner (`scripts/comfy-runner.py`) and tests (`scripts/test_comfy_runner.py`)

Design:
- An append-only, fsynced JSONL ledger.
- The UUID `prompt_id` is written as `intent` before the POST.
- The `filename_prefix` is set per attempt (`agent/runner/<job>/<prompt_id>`).
- Outputs are taken only from `/history` entries with `type: "output"`.
- V1 validation runs on every output.
- A timeout cancels the job via `/api/jobs/{id}/cancel`.
- Workflows containing API nodes are refused (there is no spend ledger yet).

Reconciliation after a lost response:
- found in `/api/jobs/{id}` → adopt it;
- 404 and the oldest retained job is older than the intent → provably absent → resubmit with the same ID;
- otherwise → `unknown-outcome`, with no retry.

| Test | Result |
| --- | --- |
| normal job | passed, 1 output |
| frozen output (execution success) | rejected: "frozen: got 17 … static run <= 4" |
| workflow with an API node (ClaudeNode) | refused, nothing submitted (`/api/jobs/{id}` 404) |
| runner exits between POST and "submitted" (exit 17) | resume adopted the job: 1 attempt, 1 output |
| runner died before POST (intent only) | absent → resubmitted with the same ID → passed |
| intent older than server history (simulated restart) | `unknown-outcome`, nothing submitted |
| **kill -9 the runner during a real Wan job** | resume adopted the running job, passed, 1 attempt, 1 output (exec 99.3 s) |
| per-job timeout (15 s) on a Wan job | ledger `timeout`; server status `cancelled` within 1 s |

The first test pass had 3 false failures. The cause was in the test helper:
**`SaveVideo` treats the last part of `filename_prefix` as a file-name stem**
(`agent/runner/x/<id>_00001_.mp4`), not a directory. The runner's orphan-output check had the
same bug and was fixed (`prefix_files`). After the fix, 9/9 passed.

## 5. Measured API behaviour (ComfyUI 0.35.0)

- **Reused `prompt_id` is not rejected.** Two POSTs with the same UUID both returned HTTP 200.
  `/api/jobs` then listed **one** job, because history is keyed by ID. A double submission is
  therefore invisible through the API. This settles the plan's "untested" note: never rely on
  `prompt_id` for idempotency. Reconcile first, as the runner does.
- `/history/{id}` lists `LoadVideo` previews as outputs with `type: "input"`. Without the type
  filter, the first silent-failure run counted 2 outputs per job.
- History is in memory. After a server restart, absence can't be proven, which is why the
  `unknown-outcome` state exists.

## Not done / next

- Not exercised:
  - ComfyUI restart mid-job (only simulated via an old intent timestamp);
  - stall timeout on progress events (the runner polls; there is no websocket);
  - retry classification on real OOMs.
- No partner-node spend ledger (E4); the runner refuses API nodes instead.
- K4 manifest; D2/D3/E2 for the other two M0 workflows.
