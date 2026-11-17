---
title: "Experiment 002 — Wan 2.1 VACE 1.3B from the Unity depth pass, locally on Apple Silicon"
date: "2026-09-23"
tags: ["unity-comfy"]
method: "Lab notebook written during the run; timings from the ComfyUI log and Unity batch log"
summary: "Find a free (no cloud, no API) way to turn the Experiment 001 blockout passes into AI video, and measure whether it is usable on the M5 Pro."
media: [{"src":"media/2026-09-23-wan-vace-1-3b-local-mac/demo-street-wan-vace.mp4","kind":"video","caption":"First AI video from the Unity blockout: Wan 2.1 VACE 1.3B, depth control, 81 frames, 832×480.","poster":"media/2026-09-23-wan-vace-1-3b-local-mac/demo-street-wan-vace.poster.jpg","thumb":"media/2026-09-23-wan-vace-1-3b-local-mac/demo-street-wan-vace.poster.thumb.jpg"},{"src":"media/2026-09-23-wan-vace-1-3b-local-mac/demo-street-comparison.mp4","kind":"video","caption":"Comparison: clay and depth passes over the result.","poster":"media/2026-09-23-wan-vace-1-3b-local-mac/demo-street-comparison.poster.jpg"},{"src":"media/2026-09-23-wan-vace-1-3b-local-mac/wan-vace-1.3b-17f.png","kind":"image","caption":"Frames from the 17-frame speed test."},{"src":"media/2026-09-23-wan-vace-1-3b-local-mac/wan-vace-1.3b-81f-vs-clay.png","kind":"image","caption":"The 81-frame result against the clay pass."}]
---

## Goal

Find a free (no cloud, no API) way to turn the Experiment 001 blockout passes into AI video, and
measure whether it is usable on the M5 Pro.

## Setup

- Hardware: Apple M5 Pro, 48 GB unified memory. ComfyUI 0.35.0, MPS backend, "vram state SHARED".
- Models (≈16 GB total), in `$COMFY_MODELS/`:
  - `diffusion_models/wan2.1_vace_1.3B_fp16.safetensors` (4.31 GB) — Comfy-Org/Wan_2.1_ComfyUI_repackaged
  - `text_encoders/umt5_xxl_fp16.safetensors` (11.37 GB) — fp16 chosen over fp8_e4m3fn because fp8 support on MPS is unreliable
  - `vae/wan_2.1_vae.safetensors` (0.25 GB)
  - `loras/Wan21_CausVid_bidirect2_T2V_1_3B_lora_rank32.safetensors` (91 MB) — Kijai/WanVideo_comfy
- Workflow (core nodes only, settings copied from ComfyUI's built-in `video_wan_vace_14B_v2v`
  template's 1.3B + CausVid branch): UNETLoader → LoraLoaderModelOnly (CausVid 0.7) →
  ModelSamplingSD3 (shift 8) → KSampler (4 steps, cfg 1.0, uni_pc, simple); CLIPLoader (type wan);
  LoadVideo(depth.mp4) → GetVideoComponents → WanVaceToVideo (strength 0.8, control_video = depth) →
  TrimVideoLatent → VAEDecode → CreateVideo → SaveVideo.
- Control input: Unity depth pass only (inverse mapping, near 2.86 m, far 17.98 m). No reference image.
- Prompt: "cinematic film still, a woman in a red coat walks along a rainy European street at dusk,
  parked blue vintage car, brick buildings, warm street lamp, shallow depth of field".
  Negative: "blurry, distorted, low quality, text, watermark".

## Results

| Run | Frames | Size | Sampling | ComfyUI total | End to end |
| --- | --- | --- | --- | --- | --- |
| Speed test (seed 42) | 17 | 832×480 | 4 steps × \~6.2 s = 25 s | 116.65 s (includes first model load) | \~120 s |
| Full shot via Unity (seed 1481443228) | 81 | 832×480 @ 16 fps | 4 steps × \~96 s = 6 min 23 s | 11 min 22 s (includes model reload + decode) | 696 s (Unity capture + upload + generate + download) |

Memory: text encoder loaded at 10,835 MB, VACE model 4,109 MB, VAE 242 MB; no out-of-memory.

## Observations

- **Layout, camera and motion follow the blockout.** The mannequin became a woman in a red coat on
  the same path; buildings, back wall, lamp post and the camera dolly/arc all line up with the Unity
  shot. Crates became planter boxes.
- **Look:** closer to a stylised game render than film — expected for 1.3B + CausVid distillation.
- **Depth over-adherence:** crates stayed boxy; flat blockout surfaces stay flat.
- **Hallucinated / dropped content:** foreground bushes appeared that are not in the blockout; the
  blue car nearly vanished (it is small and low-contrast in the depth pass).
- A local Mac is viable for iteration at 480p with the 1.3B model: \~11–12 min per 5 s shot.
  This supersedes the earlier findings-doc assumption that "a Mac is not practical" — true for 14B,
  not for 1.3B + CausVid.

## Next experiments

1. Styled first frame / reference image into WanVaceToVideo `reference_image`.
2. Lower control strength (0.8 → \~0.6) or blend clay/canny into the control video.
3. Full quality: bypass CausVid, 20 steps, cfg 6 (expect 30+ min per shot).
