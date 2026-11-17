---
title: "Experiment 001 — UnityComfy capture pipeline and ComfyUI round trip"
date: "2026-09-22"
tags: ["unity-comfy"]
method: "Lab notebook written during the run; numbers copied from Unity batch logs, ffprobe and a Python reprojection check"
summary: "Prove that a rough Unity blockout can be rendered into frame-accurate control passes and sent to ComfyUI and back, with no manual steps."
media: [{"src":"media/2026-09-22-unitycomfy-capture-pipeline/demo-street-pass-contact-sheet.png","kind":"image","caption":"Contact sheet of the capture passes for the demo street shot.","thumb":"media/2026-09-22-unitycomfy-capture-pipeline/demo-street-pass-contact-sheet.thumb.jpg"},{"src":"media/2026-09-22-unitycomfy-capture-pipeline/guide-blend-roundtrip.png","kind":"image","caption":"Guide blend after the ComfyUI round trip."}]
---

## Goal

Prove that a rough Unity blockout can be rendered into frame-accurate control passes and sent to
ComfyUI and back, with no manual steps.

## Setup

- Machine: Apple M5 Pro, 48 GB unified memory, macOS (Darwin 25.5).
- Unity 6000.6.0f1 (Unity 6.6). Project started on the **Built-in** render pipeline; switched to
  **URP 17.6.0** (bundled with the Editor) via `Tools > UnityComfy > Set Up URP`.
- Unity was driven headless with the Unity CLI: `unity run . -- -executeMethod ...`.
- ComfyUI 0.35.0 (Comfy Desktop install, Python venv, MPS backend) at `127.0.0.1:8188`.
- ffmpeg from Homebrew for MP4 encoding.

## What was built

- `ComfyShot` component: shot name, camera, PlayableDirector, preset (Wan 16 fps / 81 frames /
  832×480; Wan 1280×720; LTX 24 fps / 121 frames / 1280×704), passes, depth mapping, output folder,
  ComfyUI server, workflow, prompt, seed, first frame.
- `ComfyShotCapture`: steps the Timeline frame by frame in Edit mode (no Play mode) and renders each
  pass by temporarily swapping every renderer's material to an override shader (Depth, Normal, Flat
  ID, Clay), rendering via `RenderPipeline.SubmitRenderRequest(StandardRequest)` into a
  RenderTexture, reading back and writing PNG. Beauty uses the original materials.
- Passes: beauty, clay, depth (near = white; inverse/disparity by default, linear optional; range
  auto-measured over the whole shot from a raw eye-depth float pass), view-space normals, flat-colour
  segmentation (FNV hash of object name or `ComfyLabel`), OpenPose COCO-18 (CPU-drawn with the
  controlnet_aux palette, plus keypoint JSON), per-frame camera JSON + RealEstate10K/CameraCtrl txt.
- `ComfyClient`: uploads `<pass>.mp4` files with `POST /upload/image`, fills `{{pass:*}}`,
  `{{frame:*}}`, `{{image:first_frame}}`, `{{prompt}}`, `{{negative}}`, `{{shot}}`, `"{{seed}}"`,
  `"{{frames}}"`, `"{{fps}}"`, `"{{width}}"`, `"{{height}}"` in an API-format workflow, `POST /prompt`,
  polls `/history/{id}`, downloads outputs via `/view`.
- Demo scene `Assets/Scenes/BlockoutDemo.unity`: primitive street (buildings, back wall, crates, lamp
  post, car, tree), a primitive mannequin walking −1.8 → +1.8 m in x with explicit OpenPose keypoint
  transforms, and a Timeline camera dolly/arc of 5.0625 s (= 81 frames at 16 fps).

## Results

- **Capture speed:** 81 frames × 6 passes + MP4 encode in \~14 s wall clock (headless batch run).
- **Auto depth range:** near 2.86 m, far 17.98 m for the demo shot.
- **Bug found and fixed:** beauty frame 0 came out tinted with a single material colour (mean RGB
  `38559b` vs `7c747d` on frame 1). Cause: the first render after swapping materials back used stale
  per-material data. Fix: one discarded warm-up render of every pass before frame 0. After the fix
  frames 0 and 1 both averaged `7c747d`.
- **Async shaders:** capture disables `ShaderUtil.allowAsyncCompilation` so placeholder (cyan)
  shaders never land in frames.
- **Camera export verified:** projecting the mannequin's neck world point through the exported
  `w2c_opencv` + intrinsics matched the pose pass's drawn neck keypoint:
  frame 0 (361.8, 211.1) vs (361.8, 211.1); frame 40 (391.4, 195.6) vs (391.4, 195.7);
  frame 80 (450.0, 164.3) vs (450.0, 164.3). World frame = Unity world with Z negated (right-handed);
  camera = OpenCV (x right, y down, z forward).
- **Segmentation fidelity:** PNG frame 40 had 10 distinct colours; the lossless 4:4:4 H.264 MP4
  (`-qp 0 -pix_fmt yuv444p`) decoded to the same 10 colours.
- **ComfyUI round trip:** a model-free workflow (LoadVideo depth + LoadVideo clay → ImageBlend
  soft_light 0.5 → CreateVideo → SaveVideo mp4) ran end to end from Unity; the downloaded result
  was 832×480, 16 fps, 81 frames.

## Gotchas

- ComfyUI core `LoadVideo` lists only top-level files in `input/`, so uploads use flat names
  (`uc_<shot>_<pass>.mp4`) rather than subfolders.
- `SaveVideo` accepted a plain `"format": "mp4"` string in API JSON (DynamicCombo input).
- Launching ComfyUI manually (not via Comfy Desktop) needs the venv Python
  (`ComfyUI/.venv/bin/python`) and `--extra-model-paths-config` pointing at Comfy Desktop's
  `instance-model-paths/*.yaml`, otherwise shared models are invisible and validation fails with
  "Value not in list".
- `FindObjectsByType(..., FindObjectsSortMode)` is deprecated in Unity 6.6; use the
  `FindObjectsInactive`-only overload.
- The existing `PipelineTest` scene uses the Built-in Default-Material, which renders magenta under URP.
