---
title: "Experiment 009 — M1 batch 01: 11 small templates through download + E2 + runner + V1 on MPS"
date: "2026-10-27"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-27_0700. Local ComfyUI 0.38.2, templates 0.11.74 (comfyui_workflow_templates_json 0.1.100), frontend 1.53.6, torch 2.12.1 (Desktop venv), comfy-cli 1.23.0 (cli-venv). M5 Pro, 48 GB. One server, jobs run in sequence."
summary: "First step of M1 item 1 (D3 at scale) and item 4 (E2 rule checks). Goal: run shipped templates end to end with no person in the loop, and label each one MPS pass/fail."
media: [{"src":"media/2026-10-27-m1-batch-01-small-templates/contact-sheet.jpg","kind":"image","caption":"M1 batch 01: all image outputs."},{"src":"media/2026-10-27-m1-batch-01-small-templates/sdpose-sam3-bbox.jpg","kind":"image","caption":"Top: input and SAM3 alpha without bbox. Bottom: SDPose without bbox and SAM3 alpha with bbox."},{"src":"media/2026-10-27-m1-batch-01-small-templates/sdpose-street-nobbox.png","kind":"image","caption":"SDPose on the street frame, no bbox: skeleton."},{"src":"media/2026-10-27-m1-batch-01-small-templates/depth-anything3-video.mp4","kind":"video","caption":"Depth Anything 3 video depth estimation on the Unity clay video.","poster":"media/2026-10-27-m1-batch-01-small-templates/depth-anything3-video.poster.jpg"},{"src":"media/2026-10-27-m1-batch-01-small-templates/frame-interpolation.mp4","kind":"video","caption":"Video frame interpolation on the Unity clay video.","poster":"media/2026-10-27-m1-batch-01-small-templates/frame-interpolation.poster.jpg"}]
---

First step of M1 item 1 (D3 at scale) and item 4 (E2 rule checks). Goal: run shipped templates
end to end with no person in the loop, and label each one MPS pass/fail.

## Setup

- **New tool, `scripts/m1-batch.py`.** For each template in a batch spec it:
  1. converts UI → API with comfy-cli (`comfy run --workflow T --print-prompt`);
  2. exports the same workflow with the headless frontend (Save (API)) and diffs the two (E2);
  3. applies two rule checks: a bypassed node inside a subgraph, and a "socketless default"
     (an input comfy-cli sends that the frontend omits);
  4. points LoadImage/LoadVideo at our inputs, turns PreviewImage into SaveImage, and drops
     MaskPreview;
  5. downloads missing declared models with `fetch-model.py` (sha256 from the HF API, 30 GB cap,
     100 GB free-disk floor).
  It writes `jobs.json` for `comfy-runner.py`, whose V1 check validates every output.
- **Inputs.** The templates' own sample inputs (e.g. `alien_world.png`) are not installed locally,
  so every template ran on Unity captures:
  - image: `uc_demo_street_beauty_00040.png` (832×480);
  - video: `uc_demo_street_clay.mp4` (81 frames, 16 fps);
  - SDPose: `uc_mannequin_crop_00040.png` (768×768).
- **Templates** (each ≤ 7 GB declared): BiRefNet, DA3 image, DA3 video, FILM frame interpolation,
  MoGe-2 depth, MoGe-2 perspective → mesh, MoGe-3 geometry, SAM 3.1 image segment, SDPose
  (image → pose), Lotus depth v1.1, SDXL Turbo.

## Results

**Downloads:** 8 files, 15.9 GB, all sha256-verified, 4.8–20 MB/s. A first prepare pass was
killed by a tool time limit mid-download (`sd_xl_turbo_1.0_fp16.safetensors.part` at 6.8 GB); the
rerun resumed it and verified it. Free disk went from 649 GB to 634 GB.

**Runs:** the whole batch took 2 min 04 s of wall time (models cached after download).

| Template | Outcome | Exec s | E2 vs frontend | Notes |
| --- | --- | --- | --- | --- |
| utility_birefnet_remove_background | pass | 9.9 | identical | alpha keeps the mannequin (1.4% of pixels) |
| utility_depth_anything3_image_depth_estimation | pass | 1.9 | benign (`ImageCompare.compare_view`) | |
| utility_depth_anything3_video_depth_estimation | pass | 31.2 | benign (`SaveVideo.codec`) | 81 frames |
| utility_video_frame_interpolation | **rejected by V1** | 20.4 | benign (`SaveVideo.codec`) | V1 false positive, see below |
| utility_moge_depth_estimation | pass | 2.7 | identical | |
| 3d_moge_perspective_to_mesh | pass | 6.1 | benign (`SaveGLB.image`) | .glb unchecked |
| utility_moge3_geometry_estimation | **error (MPS)** | – | identical | `"compute_index_ranges_weights" not implemented for 'Half'` |
| utility_image_segment_sam3 | pass | 9.5 | **socketless default** `SAM3_Detect.bboxes` | template prompt "guitar" → mask is the whole frame |
| utility_sdpose_ood_image_to_pose | **rejected by V1** (all black) | 6.1 | **socketless default** `SDPoseKeypointExtractor.bboxes` | caused by the injected bbox, see below |
| image_lotus_depth_v1_1 | pass | 6.5 | identical | |
| sdxlturbo_example | pass | 11.2 | identical | |

- **MPS label:** 10 of 11 templates execute on MPS with torch 2.12.1.
  - The one real failure is MoGe-3: `F.interpolate(..., antialias=True)` on fp16 →
    `_upsample_bilinear2d_aa` has no Half kernel. `LoadMoGeModel` has no dtype option, so this
    can't be worked around from the graph.
  - MoGe-2 (fp16 too) passed: the two models take different code paths.
- **E2 over 11:** 5 identical, 4 benign, 2 with a socketless default. The bypassed-in-subgraph rule
  found nothing in this batch.

### Controlled test: comfy-cli's injected `bboxes` default (E2 rule, M1 item 4)

comfy-cli 1.23.0 still sends `bboxes = {"x":0,"y":0,"width":512,"height":512}` (the schema
default of a socketless, force-input optional input). The frontend sends nothing. Each template was
run both ways, otherwise identical:

| Template / input | With comfy-cli's bbox | Without (= frontend) |
| --- | --- | --- |
| SDPose, street frame 832×480 | 49 non-black px (no skeleton); V1 rejects as black | 4,615 px, full skeleton of the mannequin; V1 pass |
| SDPose, mannequin crop 768×768 | 0 non-black px | 2 keypoints only (weak detection on the crop); V1 rejects |
| SAM 3.1, street frame, prompt "person" | mask IoU 1.000 with the no-bbox mask | same |

- **SDPose:** the injected default suppresses detection, so it is a material conversion
  difference. The person lies inside the 512×512 box, so the cause is not simple cropping. Not
  investigated further.
- **SAM 3.1:** no effect here, but the person is also inside the box. Objects outside it weren't
  tested.
- **Fix applied:** `m1-batch.py` now removes socketless defaults from the comfy-cli prompt by
  default, matching the frontend (`--keep-socketless` turns this off). Re-preparing batch 01
  removed exactly the two `bboxes` inputs.

### V1 findings

- **Frozen-check false positive on frame interpolation.**
  - FILM doubles 81 frames to 161 at 32 fps. V1 reports a 139-frame static run, because its
    static-pair threshold is an absolute MAD of 0.5 per consecutive pair.
  - Measured: the input clay video's median consecutive MAD is 0.86, with 0% of pairs < 0.5. The
    interpolated output's is 0.56, with 26% < 0.5.
  - Output frame 2k matches input frame k (MAE 0.93), so the motion is real.
  - Halving the per-frame motion pushes a slow clip under the threshold. The threshold should
    scale with fps, or with the input's own motion.
- **Sparse pose maps:** a correct pose map is mostly black (4,615 of 605k px lit). V1 passed it, but
  rejected the 2-keypoint map. That is the right verdict for a failed detection, given for the
  wrong-sounding reason ("black").

## Observations

- Template defaults assume their sample inputs. SAM3's prompt "guitar" on our street frame gives a
  full-frame mask, which V1 passes. The runner says it "worked", but nothing was detected. M1 needs
  per-template parameter overrides (here `text = "person"`) or a content check. V1 alone can't tell.
- Speed is not a constraint for this class: every utility template ran in under 32 s.
- Everything here is a candidate for the Unity pipeline's control passes: depth (DA3, MoGe-2,
  Lotus), segmentation (SAM 3.1, BiRefNet) and pose (SDPose) all run locally on the Unity frame.

## Files

- Data: `raw/assets/experiments/2026-10-27-m1-batch-01/`. Includes `prepare.json` (per-template
  record), E2 diffs, runner ledgers, `fetch.jsonl`, `contact-sheet.jpg` (all image outputs), and
  `sdpose-sam3-bbox.jpg` (top: input and SAM3 alpha without bbox; bottom: SDPose without bbox and
  SAM3 alpha with bbox).
- Media (local): `media/2026-10-27_m1-batch-01/`.
