---
title: "Experiment 014 — runner: confirmed cancel, quiet-node check, too-slow label; M1 batch 02d/02e/02f; pose frozen check; comfy-cli 1.26.0"
date: "2026-11-13"
tags: ["unity-comfy"]
run: "scheduled run 2026-11-13_0700"
summary: "Follows Experiment 013 (lab note), which listed three runner faults and the batch-02 jobs still to run."
media: [{"src":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/wan-fun-camera-sample.mp4","kind":"video","caption":"Wan 2.1 Fun Camera v1.1 1.3B on the template’s sample start image (512², 81 frames, 18.1 min).","poster":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/wan-fun-camera-sample.poster.jpg"},{"src":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sdpose-video-sample.mp4","kind":"video","caption":"SDPose video pose map on the template’s sample clip: walking skeleton (1024 px).","poster":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sdpose-video-sample.poster.jpg"},{"src":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sdpose-sample-contact-sheet.png","kind":"image","caption":"Contact sheet of the sample-clip pose map."},{"src":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sdpose-video-unity.mp4","kind":"video","caption":"SDPose video pose map on the Unity clay clip (832 px).","poster":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sdpose-video-unity.poster.jpg"},{"src":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sam3-masks-unity.mp4","kind":"video","caption":"SAM3 video masks on the Unity clay clip (81 frames, encoded from the PNG sequence). Called “nearly empty” on 2026-11-13; corrected on 2026-11-17: they select the mannequin, median IoU 0.86 against Unity’s segmentation pass.","poster":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sam3-masks-unity.poster.jpg"},{"src":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sam3-masks-sample.mp4","kind":"video","caption":"SAM3 video masks on the template’s sample clip (160 frames, encoded from the PNG sequence).","poster":"media/2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/sam3-masks-sample.poster.jpg"}]
---

Follows Experiment 013 ([lab note](../2026-11-10-m1-batch-02bc-supervisor-node-compat/)),
which listed three runner faults and the batch-02 jobs still to run.

## Setup

- M5 Pro, 48 GB. ComfyUI 0.38.2, torch 2.12.1 (MPS), templates 0.11.74 (`/system_stats`, `pip show`).
  Started with `scripts/comfy-start.sh` (faulthandler on), stopped at the end by the pid on port 8188.
- Runner: `scripts/comfy-runner.py ... --restart-cmd scripts/comfy-start.sh`, every job with `free_before`.
- Specs: `workflows/m1/batch-02d.json` (both input sets), `batch-02e.json` (sample set), `batch-02f.json`
  (Unity set, `--no-e2`). Data: `raw/assets/experiments/2026-11-13-m1-batch-02d/`, `-02f/`, `-runner/`.
- Media (local): `media/2026-11-13_m1-batch-02def/`.
- No model downloads (all declared models present). No server crash and no supervisor restart in this run.

## Runner changes (`scripts/comfy-runner.py`)

1. **Cancel is confirmed.** After a stall or timeout cancel the runner polls `/api/jobs/{id}` and `/queue`
   for `--cancel-grace` seconds (default 30). The record gets `cancel_confirmed` and `cancel_s`. If the job
   is still running and `--restart-cmd` is set, the server is killed by the pid listening on its port and
   restarted (events `cancel-ignored`, `server-up`).
2. **Quiet-node check.** Before a stall verdict the runner samples the server process's CPU time for 10 s
   (`ps -o time=` on the port's pid). Above 0.5 core the job is working: event `quiet-but-busy`, the stall
   clock restarts, the job timeout remains the backstop. Below it: `stalled`, as before.
3. **Too-slow label.** `/ws` progress events (value/max per node) are kept per job. A timeout with at least
   two timed steps gets `label: too-slow`, `s_per_step`, `projected_s`, `steps_done/steps_total`.
4. Not done: timeouts derived from resolution × frames. The label needs no model of speed; a derived
   timeout does, and there are too few timed templates to fit one.

### Tests

- **New, no GPU:** `scripts/test_runner_fake.py` runs the runner against a fake ComfyUI (HTTP + `/ws`) in
  four modes. **5 of 5** (`raw/assets/experiments/2026-11-13-runner/fake-tests.json`):

| Case | Result |
| --- | --- |
| idle server, no events | `stalled`, server measured at 0.0 cores, `cancel_confirmed: true` |
| cancel ignored, no supervisor | `stalled`, `cancel_confirmed: false`, server untouched |
| cancel ignored, with supervisor | events `cancel-ignored`, `server-up`; new server pid; `queue_running` empty |
| busy server, no events | 2 `quiet-but-busy` deferrals (1.05 and 1.07 cores), ends `timeout`, not `stalled` |
| progress every 0.5 s, 12 s timeout | `timeout`, `label: too-slow`, 0.6 s/step, projected 117 s, step 21/200 |

- **Existing integration tests** against the real server after the change:
  `scripts/test_comfy_runner.py --quick` **10 of 10** (`integration-quick.json`). The two Wan cases
  (kill mid-run, timeout-cancel) were not run.
- A first version of the fake server hung at start: `HTTPServer.server_bind` calls `socket.getfqdn()`,
  which blocked on this Mac. The fake server binds without it.

### In real use this run

- **Too slow:** SeedVR2 video on the sample clip ended `timeout` with `label: too-slow`, step 8 of 12 at
  139.8 s/step, projected 1678 s (28 min) against a 1200 s limit. `cancel_confirmed: true` in 3.0 s.
- **Confirmed cancel:** SeedVR2 video on the Unity clip, `cancel_confirmed: true` in 3.1 s.
- **Not exercised live:** the quiet-node check and the cancel-ignored restart. MoGe panorama, the job that
  showed both faults on 2026-11-10, finished in 58.7 s this time (below), so neither path fired.

## Run results

| Job | Input | Result | Exec time | Notes |
| --- | --- | --- | --- | --- |
| utility_sdpose_ood_video_to_pose_map | Unity clay video 832×480, 81 f | **error** at SaveVideo | 103 s to the error | `av.error.ExternalError: [Errno 542398533] Generic error in an external library: 'avcodec_open2("libx264", {})'`. The template scales the longer side to 1024, so 832×480 becomes 1024×591; libx264 with yuv420p needs even dimensions (my reading of the error; the height is computed, not logged) |
| utility_sdpose_ood_video_to_pose_map | Unity clay video, `resize_type.longer_size` = 832 (batch 02f) | **passed** V1 (`kind: pose`) | 104.4 s | 832×480, 81 frames, median lit fraction 0.00521, median MAD 0.447. Was "about 20 min" projected on 2026-11-03 with comfy-cli's injected `bboxes` |
| utility_sdpose_ood_video_to_pose_map | sample (`man_in_the_rain.mp4`) | V1 **rejected** (`frozen`: static run 36 > 30 frames), **wrong verdict** | 148.2 s | 1024×576, 121 frames, lit 0.02508, median MAD 0.487. The contact sheet shows a skeleton walking toward the camera (`media/2026-11-13_m1-batch-02def/sdpose-sample-contact-sheet.png`). Passes after the validator fix below |
| utility_video_segment_sam3 | sample (`drinking_unicorn.mp4`) | **passed** | 331.0 s | 160 mask PNGs 1080², luma mean 26.5–32.3. Timed out at 300 s on the Unity clip on 2026-11-03 |
| utility_video_segment_sam3 | Unity clay video | **passed** V1; content not meaningful | 165.8 s | 81 mask PNGs 832×480, luma mean 1.27–7.11. The template's prompt is "unicorn"; the masks are nearly empty. V1 passes because they are not fully black. A "wrong input" pass, as with SAM3 image on 2026-10-27 |
| video_wan2.1_fun_camera_v1.1_1.3B | sample start image | **passed** | 1087.5 s (18.1 min) | 512×512, 81 frames, 16 fps, median MAD 5.06; 20 steps at about 49 s/step. Unity twin on 2026-11-10: 1075 s |
| utility_seedvr2_3b_int8_upscale_video | Unity clay video | **timeout** (1200 s), cancel confirmed | n/a | One sampling step in 65 s, then no finish. The log shows no further progress lines, so where the remaining time went (the VAE stage is my guess) is not established; no label because only one step was timed |
| utility_seedvr2_3b_int8_upscale_video | sample (`grainy_perfume_shot_crf32.mp4`) | **timeout** (1200 s), `too-slow` | n/a | 8 of 12 steps at 139.8 s/step; 28 min of sampling projected |
| 3d_moge_panorama_to_mesh | Unity frame (batch 02f) | **passed** (GLB written; no V1 check for the type) | 58.7 s | Third different outcome on the same input and build: segfault (2026-11-03), 7-minute run with a false stall and an ignored cancel (2026-11-10), 59 s pass today. Today it ran after `/free` with only SDPose loaded before it; on 2026-11-10 it ran after two SAM 3D Body crashes and restarts. Cause not established |

Batch 02 status after this run (12 templates): 7 pass on at least one input set (SAM3 video, SDPose
video, SDPose multi-person image, MoGe panorama, SeedVR2 image, Wan text-to-video, Wan Fun Camera);
SeedVR2 video too slow on both sets; SAM 3D Body crashes the server (2 of 2, 2026-11-10); Wan Fun
Control too slow at defaults; TripoSplat timed out on both sets (2026-11-03, not retried);
`utility_sdpose_multi_person_video` has not been run yet (left out of this run's specs by oversight).

## V1: frozen check on pose videos (`scripts/validate-output.py`)

- Fault: the frozen check compares whole-frame mean absolute difference with 0.5. A skeleton covering
  2.5% of a black frame moves with a whole-frame MAD of about 0.49, so a moving pose video was "frozen".
- Fix: for `kind: pose` a frame pair is static if MAD < 0.02 × 255 × median lit fraction (capped at 0.5).
  For the sample video the threshold is 0.128; it passes.
- Tests: `scripts/test_validate_output.py` **11 of 11**, with two new synthetic cases (a moving bar on
  black passes, the same bar held still is rejected as frozen).
- The threshold comes from one real video and two synthetic ones.

## comfy-cli 1.26.0 against the frontend (E2)

- Why: its release notes list "do not synthesize an optional widget the save never carried" (#1076) and
  "inline promoted subgraph values into non-widget interior sockets" (#1115), which read like our E2 findings.
- Setup: comfy-cli 1.26.0 in a separate venv (`$COMFY_INSTALL/cli126-venv`); the working
  `cli-venv` stays on 1.23.0. `scripts/cli-convert-compare.py` converts each template with both versions
  and diffs against stored frontend Save (API) exports (20 from 2026-10-23, 4 from this run), with the E2 rules.
- Result: **24 of 24 templates convert identically in 1.23.0 and 1.26.0.** 12 match the frontend, 12
  differ, the same 12 with the same differences. The injected `bboxes` default (`{"x":0,"y":0,"width":512,
  "height":512}`) is still sent for `SAM3_Detect` (image and video templates) and `SDPoseKeypointExtractor`.
  Data: `raw/assets/experiments/2026-11-13-runner/cli-1.23.0-vs-1.26.0.json`.
- So the strip of socketless defaults in `m1-batch.py` stays, and 1.26.0 gives no reason to upgrade the cli.

## Other changes

- `scripts/m1-batch.py`: `params` keys split at the first dot, so input names with dots
  (`675:674.resize_type.longer_size`) work.

## Observations

- Two of this run's three wrong or missing verdicts were about our own checks (odd output size is the
  template's fault; "frozen" pose video and the unicorn masks are V1's). V1 still has no notion of
  "the mask is empty because the prompt does not match the input".
- A template that hard-codes "scale longer side to 1024" fails on any input whose scaled height is odd.
  A pre-flight check on output dimensions for video saves would catch it before the run.
- MoGe panorama is nondeterministic across runs on this build in a way that matters (crash / hang / pass).
- SeedVR2 video is out of reach at template defaults on torch 2.12.1: 140 s/step on the sample clip.
  ComfyUI 0.45.0 changes its VAE slicing (release note title only; not tested).

## Next

- The upgrade test on a copy of the install (torch 2.15.0 + ComfyUI 0.45.0) remains the open decision; SAM
  3D Body, MoGe panorama (repeat runs), Wan Fun Control and SeedVR2 video are its first jobs.
- A pre-flight check for odd video dimensions; an "empty mask" check for segmentation outputs.
- Repeat MoGe panorama 5 times in one session, before and after a model-heavy job, to see what the three
  outcomes depend on.
