---
title: "Experiment 012 — M1 batch 02 (video/3D/upscale templates, Unity and sample inputs), partial; V1 motion stride; fetch and rewrite fixes"
date: "2026-11-03"
tags: ["unity-comfy"]
run: "scheduled run 2026-11-03_0700"
summary: "Plan item: M1 item 1 (D3 at scale), with items 4 (E2 rules) and V1. First batch judged on both input sets, as decided on 2026-10-27."
media: [{"src":"media/2026-11-03-m1-batch-02-video-3d-templates/sdpose-multi-sample-pose.jpg","kind":"image","caption":"SDPose multi-person on the template’s sample photo of about 8 people: one detection (the template ships max_detections = 1). Pose map only; the sample photo is not reproduced.","thumb":"media/2026-11-03-m1-batch-02-video-3d-templates/sdpose-multi-sample-pose.thumb.jpg"},{"src":"media/2026-11-03-m1-batch-02-video-3d-templates/seedvr2-upscale-unity.jpg","kind":"image","caption":"SeedVR2 3B int8 image upscale of the Unity frame."}]
---

**Plan item:** M1 item 1 (D3 at scale), with items 4 (E2 rules) and V1. First batch judged on both
input sets, as decided on 2026-10-27.

## Setup

- ComfyUI 0.38.2, torch 2.12.1, templates 0.11.74 (json 0.1.100), comfy-cli 1.23.0. Mac M5 Pro 48 GB.
  ComfyUI started for the run, restarted once after a crash, stopped at the end.
- `workflows/m1/batch-02.json`: 12 templates. Utility video: SAM3 video segmentation, SDPose OOD video,
  SDPose multi-person image and video, SAM 3D Body. 3D: MoGe panorama to mesh, TripoSplat. Upscale:
  SeedVR2 3B int8 image and video. Wan 2.1 1.3B: text-to-video, Fun Control, Fun Camera v1.1.
- New `m1-batch.py --input-set both`: one job on Unity inputs and one `@sample` job on the template's
  own inputs. Sample inputs are downloaded from
  `https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/input/<file>`: 12 files, 0.7–6 MB
  each, all fetched (`inputs.jsonl`, with sha256). Text-only templates get no `@sample` twin, so there
  are 23 jobs.
- Model downloads: 9 files, 24.4 GB, all sha256-verified (`fetch.jsonl`). The batch budget was 28 GB.

## Preparation results

- **All 12 templates converted** with comfy-cli.
- **E2:** 10 of 12 were "different" only in benign ways (`SaveVideo.codec`, viewport state).
  - SAM3 video: the socketless `bboxes` default was stripped automatically, as in batch 01.
  - SDPose OOD video: the headless frontend export failed ("frontend app did not initialise"), so
    there is no E2 diff.
  - **SDPose multi-person (image and video): the installed frontend scrambles widget values inside
    the subgraph.** Frontend export: `CheckpointLoaderSimple.ckpt_name = "person"`,
    `UNETLoader.unet_name = 1`, `RTDETR_detect.threshold = 2`, `SDPoseDrawKeypoints.draw_hands =
    "lanczos"`. That is 12–13 differences. comfy-cli's values match the template's `widgets_values` and
    the node schema. A browser user on this install would get a broken graph; the unattended runner
    uses comfy-cli and is unaffected.
- **TripoSplat:** the `bypassed-in-subgraph` rule flagged a bypassed `PreviewImage` inside the subgraph.
- **Bug found and fixed in `fetch-model.py`:** it refused Hugging Face URLs ending in
  `?download=true` (Wan t2v, Fun Control, umt5 fp8), because its URL regex ran to the end of the
  string. The query is now ignored.
  - Re-fetch after the fix: ok.
  - A background download killed at 2.49 GB resumed with HTTP Range and verified (102 s, 6.2 MB/s).
- **Bug found and fixed in `m1-batch.py`:** SAM3 video's only output is a `MaskPreview`, which the
  rewriter dropped. Both jobs failed with `prompt_no_outputs`. It is now rewritten to
  `MaskToImage → SaveImage`.

## Run results (partial: 8 of 23 jobs judged before the time cap)

| Job | Input | Result | Exec time | Notes |
| --- | --- | --- | --- | --- |
| utility_sdpose_multi_person | Unity mannequin crop | V1 rejected (black) | 38.1 s | Correct verdict: RT-DETR found no person on the mannequin; pose map has 0 lit px |
| utility_sdpose_multi_person | sample (group photo) | V1 rejected (black) | 11.9 s | V1 false positive: one skeleton drawn (2,337 lit px of 1024²). Only 1 of \~8 people, because the template ships `RTDETR_detect.max_detections = 1` |
| utility_seedvr2_3b_int8_upscale_image | Unity frame | **passed** | 360 s | int8 weights run as "emulated ops" on MPS |
| utility_seedvr2_3b_int8_upscale_image | sample (watch macro) | **passed** | 261 s | |
| 3d_moge_panorama_to_mesh | Unity frame | **segfault: killed ComfyUI** | — | `Fatal Python error: Segmentation fault` in `comfy/ldm/moge/panorama.py:130 _grid_sample_uv` (`moge-panorama-segfault.log`). The runner recorded `error: lost: server has no record … (ComfyUI restarted?)` after a manual restart. A leftover retry ran on the restarted server without crashing, at 121–171 s per tile (12 tiles), and was interrupted after 11.9 min |
| 3d_triposplat_image_to_gaussian_splat | Unity frame | timeout (600 s) | — | Never started: it was queued behind the leftover MoGe prompt |
| 3d_triposplat_image_to_gaussian_splat | sample | timeout (600 s) | 525 s, cancelled | Loaded BiRefNet and DINOv3, then made no visible progress |
| utility_video_segment_sam3 | Unity clay video (81 f) | timeout (300 s) | 281 s, cancelled | With the MaskPreview fix the prompt is accepted and runs; it does not finish within 300 s |
| utility_sdpose_ood_video_to_pose_map | Unity clay video | stopped (operator) | — | Measured before it was stopped: \~15 s per frame after the first (79 s), so \~20 min for 81 frames |

Not run (time cap; 14 jobs): SAM3 video `@sample`, SDPose video (×2, 1 partial), SAM 3D Body ×2,
SeedVR2 video ×2, Wan t2v, Wan Fun Control ×2, Wan Fun Camera ×2, MoGe panorama `@sample`.

## V1: frozen check with a motion stride

- `validate-output.py --motion-fps M` (runner: `expect.motion_fps`): static pairs compare frames
  `round(fps / M)` apart.
- On the 2026-10-27 FILM output (161 frames, 32 fps):
  - stride 1: static run 139 > 40, rejected, median MAD 0.34;
  - `--motion-fps 16`: stride 2, static run 9, **passed**, median MAD 0.65.
- Synthetic frozen 32 fps clip (32 frames): rejected at stride 2 (static run 31, MAD 0.00).
- The Unity clay video passes either way.
- Runner and validator test suites were re-run before the batch: all cases ok.

## Observations

- **Video utility templates are slow on MPS at template defaults.** SDPose video \~15 s per frame.
  SAM3 video doesn't finish in 300 s on 81 frames. MoGe panorama runs 2–3 min per tile. So D3 needs a
  "too slow" label alongside pass/fail, and per-class timeouts (image ≤ 600 s, video by frame count).
- **One template can take the server down** (MoGe panorama segfault). The runner reconciled the lost
  job correctly but waits until its deadline while the server is down. An unattended batch needs a
  supervisor that restarts ComfyUI, and must not resubmit a job that crashed the server.
- **Sample inputs earned their place on the first batch.** They separate "no person on our mannequin"
  (Unity) from "template detects one person by default" (sample).
- V1's black check misreads sparse pose maps again. Pose outputs need a lit-pixel or keypoint-count
  check instead.
