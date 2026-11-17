---
title: "Experiment 013 — runner supervisor in real use, M1 batch 02b/02c (Wan 2.1 templates, SAM 3D Body, MoGe panorama, SDPose), pose-map check, Comfy-Org template checker on this install"
date: "2026-11-10"
tags: ["unity-comfy"]
run: "scheduled run 2026-11-10_0700 (finishes the work the killed 2026-11-06_0700 run started)"
summary: "Plan items: M1 item 1 (D3 at scale: the batch 02 jobs not reached on 2026-11-03), M1 item 4 (E2 rule checks, via Comfy-Org's checker per plan rev 10), V1 (pose maps), and the supervisor that Experiment 012 called for."
media: [{"src":"media/2026-11-10-m1-batch-02bc-supervisor-node-compat/wan-fun-camera-unity.mp4","kind":"video","caption":"Wan 2.1 Fun Camera v1.1 1.3B, “Zoom In” on the Unity street frame (512², 81 frames, 17.9 min).","poster":"media/2026-11-10-m1-batch-02bc-supervisor-node-compat/wan-fun-camera-unity.poster.jpg"},{"src":"media/2026-11-10-m1-batch-02bc-supervisor-node-compat/wan-t2v.mp4","kind":"video","caption":"Wan 2.1 text-to-video at template defaults (832×480, 33 frames, 12.3 min).","poster":"media/2026-11-10-m1-batch-02bc-supervisor-node-compat/wan-t2v.poster.jpg"},{"src":"media/2026-11-10-m1-batch-02bc-supervisor-node-compat/wan-fun-control-frames.mp4","kind":"video","caption":"The 81 control frames Wan Fun Control saved before it timed out (encoded from the PNG sequence).","poster":"media/2026-11-10-m1-batch-02bc-supervisor-node-compat/wan-fun-control-frames.poster.jpg"}]
---

**Plan items:** M1 item 1 (D3 at scale: the batch 02 jobs not reached on 2026-11-03), M1 item 4
(E2 rule checks, via Comfy-Org's checker per plan rev 10), V1 (pose maps), and the supervisor that
Experiment 012 called for.

## Why the 2026-11-06 run died

- The 2026-11-06 scheduled run ended after 12 minutes with exit 137 and no brief.
- Cause: the new supervisor test in `scripts/test_comfy_runner.py` killed ComfyUI with
  `pkill -9 -f "main.py --listen 127.0.0.1 --port 8188"`. The scheduled agent's own command line
  contains that string (the run prompt quotes the ComfyUI start command), and the test ran detached
  from the agent, so `pkill` did not exclude it as an ancestor. The agent was SIGKILLed with the
  server. The test itself went on and passed (`raw/assets/experiments/2026-11-06-supervisor/`).
- Fix: the test kills the pid that listens on the server port (`lsof -ti tcp:8188 -sTCP:LISTEN`).
  No script in the repo matches processes by command line any more.

## Setup

- ComfyUI 0.38.2, torch 2.12.1, templates 0.11.74, Mac M5 Pro 48 GB. ComfyUI was already running
  (left over from the 2026-11-06 test); it was restarted five times during this run (twice by the
  test suite, twice by SAM 3D Body crashes, once by hand, below) and stopped at the end.
- Runner invoked as `scripts/comfy-runner.py JOBS --ledger L --restart-cmd scripts/comfy-start.sh`,
  `free_before` on every batch job, `--max-retries 0`.
- Inputs as in Experiment 012 (Unity `demo_street` frame/clay/depth videos; template sample inputs
  for `@sample` jobs).

## Supervisor (new in `comfy-runner.py`)

- `--restart-cmd CMD`: when the server is unreachable for `--down-grace` seconds (default 20), the
  runner writes a `server-down` event, runs CMD detached, waits up to `--restart-wait` (180 s) for
  `/system_stats`, and writes `server-up`. At most `--max-restarts` (3) per run.
- A local job the restarted server has no record of, with no output files, ends `error`:
  - `retryable=false` ("crashed") if it was executing when the server went away;
  - `retryable=true` ("lost") if it was still queued.
- `scripts/comfy-start.sh` starts ComfyUI detached. Since this run it passes `-X faulthandler`
  (added after the SAM 3D Body crashes below left no traceback; not yet exercised by a crash).
- Test suite (`runner-tests.log`, 2026-11-10): **14 of 14 cases ok**, including the new
  `supervisor-restart` case: ComfyUI SIGKILLed during a real Wan VACE job → `server-down`,
  `server-up` after 4.5 s, the job `error`/`retryable=false`, the next job in the list `passed`;
  13.8 s from kill to runner exit.

## Run results

| Job | Input | Result | Time | Notes |
| --- | --- | --- | --- | --- |
| wan2.1_fun_control | Unity depth video | **timeout (2400 s)**, cancelled | 9 of 20 steps in 37.9 min | Template default 960×544×77 frames: 253–259 s per step, so about 86 min of sampling. Too slow at defaults on torch 2.12.1, not a failure |
| video_wan2.1_fun_camera_v1.1_1.3B | Unity frame, "Zoom In" | **passed** V1 | 1075 s (17.9 min) | 512×512×81 frames, 20 steps at 48.8–48.9 s per step. 81 frames, 16 fps, median MAD 4.14. The runner was killed and restarted mid-job on purpose (queue re-plan) and adopted the running job from the ledger |
| utility_sdpose_multi_person | Unity mannequin crop | V1 **rejected** (`lit_pixels` 0.0) | 3.0 s | Correct: no person detected, pose map empty |
| utility_sdpose_multi_person | sample (group photo) | **passed** (`lit_pixels` 0.00358) | 2.1 s | Was a V1 false positive on 2026-11-03 (black check); fixed by `kind: pose` |
| utility_sam3d_body | Unity clay video (81 f) | **crashed ComfyUI** | 3 min 25 s to detection | SAM3 tracking finished (80/80, 2 min 20 s); the process died at the first MoGe inference step with no traceback and no macOS crash report. Supervisor: restart in 5.6 s; `error`, `retryable=false`, not resubmitted |
| utility_sam3d_body | sample video (151 f) | **crashed ComfyUI** | 5 min 36 s to detection | Same point: tracking 150/150 (5 min 2 s), then death at MoGe inference 0/150. Supervisor: restart in 41.3 s. Reproducible, 2 of 2 |
| 3d_moge_panorama_to_mesh | Unity frame | **stalled** (no `/ws` event for 300 s), cancelled; **verdict wrong, and the cancel did not free the server** | 7 min 13 s | No segfault this time. The log shows the node progressing in a merge stage (`MoGe panorama merge: solving 832x480`, 41/57) without `/ws` progress events. After the cancel the server kept computing at 100% CPU for 11 more minutes and the next job sat queued behind it. Freed by killing the server pid by hand |
| text_to_video_wan (first attempt) | text | `error`, `retryable=true` ("lost") | — | Queued behind the stuck MoGe prompt when the server was killed; supervisor restart in 5.4 s; correctly classed as lost-while-queued |
| text_to_video_wan (retry) | text | **passed** V1 | 739 s (12.3 min) | 832×480×33 frames, 30 steps at 22.5 s per step; 33 frames, 16 fps, median MAD 2.10. Run as attempt 2 with `--max-retries 1`: without it the runner, correctly, does not resubmit a job whose last attempt is final |

Not run (time): the `@sample` twins of Fun Control and Fun Camera, MoGe panorama `@sample`, SeedVR2
video ×2, SAM3 video `@sample`, SDPose video ×2. `jobs-planned.json` in each data folder holds the
planned lists; `jobs*.json` what was submitted.

## V1: pose maps

- `validate-output.py --kind pose` (runner: `expect.kind = "pose"`, optional `min_lit_frac`): the
  black and flat checks are replaced by `lit_pixels`, the median per-frame fraction of pixels above
  luma 32, which must reach 0.0005.
- Synthetic tests (`validate-tests.log`): sparse skeleton passes (lit 0.01078), all-black map
  rejected. Real outputs: the two SDPose rows above (0.0 rejected, 0.00358 passed).

## Comfy-Org's template checker on this install (M1 item 4)

- `scripts/template-compat.py` downloads `scripts/comfyui_node_compat/` from
  Comfy-Org/workflow_templates at tag v0.11.104 into a temp dir, dumps this server's
  `/object_info` (970 node types) and runs the checker over the installed templates (0.11.74).
- Result (`raw/assets/experiments/2026-11-10-node-compat/summary.json`): 590 workflows checked,
  **63 with findings, 107 findings**:
  - 65 `deprecated_node` warnings;
  - 37 `invalid_combo_value`: 28 are model file names not downloaded here (expected), 9 are option
    drift (the template names an option the installed node does not offer);
  - 3 `invalid_widget_value` and 2 `widget_slot_mismatch`, all in partner-node templates
    (Seedream 5.0 Lite image edit, Kling v3) — the fault class Comfy-Org fixed upstream in 0.11.101.
- For the 23 M1 templates of batches 01–02: findings on 2.
  - `3d_moge_perspective_to_mesh`: one deprecated node (it passed in Experiment 009).
  - `utility_sam3d_body`: option drift on two dynamic combos (`BuildPoseFile.mesh_style = scail`,
    `SAM3DBody_Render.shader = default`).
- What the checker did and did not predict here:
  - The SAM 3D Body prompt was accepted and ran for minutes, so the drift did not block validation.
    The crash came earlier in the graph than the two flagged nodes would matter. The checker flagged
    the one M1 template that then failed, but not for the reason it failed.
  - It reports nothing for the SDPose multi-person template, as expected: that fault (2026-11-03) is
    in the headless frontend's conversion, which a template-level checker never sees.
  - Neither MoGe crash nor any "too slow" case is visible to it.

## Observations

- **The supervisor did its job unattended**: two real crashes, each detected, restarted (5.6 s and
  41.3 s), classed `crashed` and not resubmitted, and the batch went on. A queued job lost to a
  restart was classed `lost`/retryable.
- **"Cancelled" is not "the server is free".** The MoGe panorama merge ignored the interrupt. The
  runner should confirm the queue is empty after a cancel and, if the prompt is still running after a
  grace period, restart the server through the supervisor.
- **The stall check gives false positives on nodes that report progress only to the terminal.** The
  MoGe merge was progressing. Per-node-class stall timeouts, or no stall check for known quiet nodes,
  are needed; the timeout check remains the backstop.
- **MoGe inside ComfyUI 0.38.2 on MPS is the common factor in every server death so far**: panorama
  `_grid_sample_uv` segfault (2026-11-03) and SAM 3D Body's MoGe step (2 of 2 here). MoGe depth and
  perspective templates passed in Experiment 009, so it is not MoGe as such. Not tested on torch 2.15.
- **Wan at template defaults is slow on torch 2.12.1**: Fun Camera (512²×81) 17.9 min; Fun Control
  (960×544×77) projected about 86 min. D3 needs the "too slow" label and a timeout derived from
  resolution × frames. Experiment 008 measured about 1.9× faster Wan on torch 2.15, which would still
  leave Fun Control near 45 min.
