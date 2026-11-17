// Which media files are published, per experiment note.
//
// `post`  : experiment slug (the source note's file name without .md)
// `src`   : path relative to the unity-comfy branch root. One `*` is allowed in the
//           last path segment (ComfyUI output names start with a job uuid).
// `out`   : published file name under public/media/<post>/
// `seq`   : src is a glob of PNG frames; they are encoded to one H.264 mp4 at `fps`
// `crop`  : ffmpeg crop expression applied to an image
// `brief` : also show this item on the run brief of the same date
// `gen`   : instead of `src`: name of a generator in scripts/figures.mjs (SVG drawn
//           from the note's own recorded numbers, for notes with no image)
//
// Every post needs at least one item: the first one is its cover image.
//
// Not published on purpose: runner-test fixture clips, raw per-frame PNG dumps,
// 3D files (.glb/.spz/.ply), and outputs that show the third-party sample photos
// or footage of people that ship with the ComfyUI templates.

const M = 'media';
const A = 'raw/assets/experiments';

export default [
  // Experiment 001
  { post: '2026-09-22-unitycomfy-capture-pipeline', src: `${A}/2026-09-22-demo-street-pass-contact-sheet.png`, out: 'demo-street-pass-contact-sheet.png', caption: 'Contact sheet of the capture passes for the demo street shot.' },
  { post: '2026-09-22-unitycomfy-capture-pipeline', src: `${A}/2026-09-22-guide-blend-roundtrip.png`, out: 'guide-blend-roundtrip.png', caption: 'Guide blend after the ComfyUI round trip.' },

  // Experiment 002
  { post: '2026-09-23-wan-vace-1.3b-local-mac', src: `${M}/2026-09-23_demo-street_wan-vace/delivered/demo_street_wan_vace_00001_.mp4`, out: 'demo-street-wan-vace.mp4', caption: 'First AI video from the Unity blockout: Wan 2.1 VACE 1.3B, depth control, 81 frames, 832×480.' },
  { post: '2026-09-23-wan-vace-1.3b-local-mac', src: `${M}/2026-09-23_demo-street_wan-vace/delivered/demo_street_comparison.mp4`, out: 'demo-street-comparison.mp4', caption: 'Comparison: clay and depth passes over the result.' },
  { post: '2026-09-23-wan-vace-1.3b-local-mac', src: `${A}/2026-09-23-wan-vace-1.3b-17f.png`, out: 'wan-vace-1.3b-17f.png', caption: 'Frames from the 17-frame speed test.' },
  { post: '2026-09-23-wan-vace-1.3b-local-mac', src: `${A}/2026-09-23-wan-vace-1.3b-81f-vs-clay.png`, out: 'wan-vace-1.3b-81f-vs-clay.png', caption: 'The 81-frame result against the clay pass.' },

  // Experiment 003
  { post: '2026-10-02-v1-validator-silent-failure-test', brief: true, src: `${M}/2026-10-02_silent-failure-test/run-3/control_00001_.mp4`, out: 'sft-control.mp4', caption: 'Silent-failure test, control clip (untouched): passed.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', brief: true, src: `${M}/2026-10-02_silent-failure-test/run-3/black_00001_.mp4`, out: 'sft-black.mp4', caption: 'Deliberately broken output, black: ran with no error in ComfyUI, rejected by the validator.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', src: `${M}/2026-10-02_silent-failure-test/run-3/flat_grey_00001_.mp4`, out: 'sft-flat-grey.mp4', caption: 'Deliberately broken output, flat grey: rejected.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', src: `${M}/2026-10-02_silent-failure-test/run-3/frozen_00001_.mp4`, out: 'sft-frozen.mp4', caption: 'Deliberately broken output, frozen: rejected.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', src: `${M}/2026-10-02_silent-failure-test/run-3/frozen_tail_00001_.mp4`, out: 'sft-frozen-tail.mp4', caption: 'Deliberately broken output, frozen tail: rejected.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', src: `${M}/2026-10-02_silent-failure-test/run-3/truncated_00001_.mp4`, out: 'sft-truncated.mp4', caption: 'Deliberately broken output, truncated: rejected.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', src: `${M}/2026-10-02_wan-vace-repeat-30-runs/r00_00001_.mp4`, out: 'repeat-r00.mp4', caption: 'Wan VACE repeat runs (30 seeds × 17 frames, 30/30 valid): run r00.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', src: `${M}/2026-10-02_wan-vace-repeat-30-runs/r01_00001_.mp4`, out: 'repeat-r01.mp4', caption: 'Repeat run r01.' },
  { post: '2026-10-02-v1-validator-silent-failure-test', src: `${M}/2026-10-02_wan-vace-repeat-30-runs/r02_00001_.mp4`, out: 'repeat-r02.mp4', caption: 'Repeat run r02.' },

  // Experiment 004
  { post: '2026-10-06-m0-three-workflows-k4-manifest', src: `${M}/2026-10-06_m0-workflows/wan-vace-17f/*_00001_.mp4`, out: 'm0-wan-vace-17f.mp4', caption: 'M0 workflow 1: Wan VACE, 17 frames.' },
  { post: '2026-10-06-m0-three-workflows-k4-manifest', brief: true, src: `${M}/2026-10-06_m0-workflows/birefnet-unity-frame/*_00001_.png`, out: 'm0-birefnet-cutout.png', caption: 'M0 workflow 2: BiRefNet cutout of a Unity frame (IoU 0.972 against Unity’s segmentation pass).' },
  { post: '2026-10-06-m0-three-workflows-k4-manifest', brief: true, src: `${M}/2026-10-06_m0-workflows/triposplat-131k_black-preview/*_00002_.mp4`, out: 'triposplat-131k-black-preview.mp4', caption: 'The MPS silent failure: TripoSplat’s orbit preview reported success and saved a fully black video.' },
  { post: '2026-10-06-m0-three-workflows-k4-manifest', src: `${A}/2026-10-06-k4-regression/triposplat-262k-preview.png`, out: 'triposplat-262k-preview.png', caption: 'Point preview of the 262k splat. The input was ComfyUI’s stock example.png placeholder: a plumbing test, not a chosen subject.' },
  { post: '2026-10-06-m0-three-workflows-k4-manifest', src: `${M}/2026-10-06_wan-vace-repeat-5-runs_comfyui-0.38.2/r00_00001_.mp4`, out: 'repeat-0.38.2-r00.mp4', caption: 'Wan VACE re-check after the ComfyUI 0.38.2 update (5/5 valid): run r00.' },

  // Experiment 005
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', brief: true, src: `${M}/2026-10-23_wan-depth-adherence/contact-frame8.jpg`, out: 'contact-frame8.jpg', caption: 'Frame 8: ground-truth depth, beauty, and four conditions side by side.' },
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', src: `${M}/2026-10-23_wan-depth-adherence/adh-s0.8-seed7/*_00001_.mp4`, out: 'adh-s0.8-seed7.mp4', caption: 'Control strength 0.8, seed 7.' },
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', src: `${M}/2026-10-23_wan-depth-adherence/adh-s0.4-seed7/*_00001_.mp4`, out: 'adh-s0.4-seed7.mp4', caption: 'Control strength 0.4, seed 7: structure lost at half strength.' },
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', src: `${M}/2026-10-23_wan-depth-adherence/adh-s0.0-seed7/*_00001_.mp4`, out: 'adh-s0.0-seed7.mp4', caption: 'Control strength 0.0, seed 7.' },
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', src: `${M}/2026-10-23_wan-depth-adherence/adh-hflip-seed7/*_00001_.mp4`, out: 'adh-hflip-seed7.mp4', caption: 'Horizontally flipped depth control, seed 7.' },
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', src: `${M}/2026-10-23_wan-depth-adherence/adh-shift96-seed7/*_00001_.mp4`, out: 'adh-shift96-seed7.mp4', caption: 'Depth control shifted 96 px, seed 7.' },
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', src: `${M}/2026-10-23_wan-depth-adherence/controls/uc_demo_street_depth_hflip.mp4`, out: 'control-depth-hflip.mp4', caption: 'Perturbed control: the flipped depth video.' },
  { post: '2026-10-23-wan-depth-adherence-and-p1-download', src: `${M}/2026-10-23_wan-depth-adherence/controls/uc_demo_street_depth_shift96.mp4`, out: 'control-depth-shift96.mp4', caption: 'Perturbed control: the depth video shifted 96 px.' },

  // Experiment 006
  { post: '2026-10-23-triposplat-silhouette-adherence', src: `${M}/2026-10-23_triposplat-silhouette/silhouettes.png`, out: 'silhouettes.png', caption: 'Ground-truth mask, splat silhouette and overlap, for both subjects.' },
  { post: '2026-10-23-triposplat-silhouette-adherence', src: `${M}/2026-10-23_triposplat-silhouette/uc_mannequin_crop_00040.png`, out: 'mannequin-crop-input.png', caption: 'TripoSplat input: Unity mannequin crop.' },

  // Experiment 008
  { post: '2026-10-23-torch-2.15-mps-inv-and-wan', src: `${M}/2026-10-23_torch-2.15-mps/preview-strip.jpg`, out: 'preview-strip.jpg', caption: 'Orbit preview frames at four angles on torch 2.15.0: not black.' },
  { post: '2026-10-23-torch-2.15-mps-inv-and-wan', src: `${M}/2026-10-23_torch-2.15-mps/torch215-triposplat-preview-262k/*_00002_.mp4`, out: 'triposplat-preview-262k.mp4', caption: 'TripoSplat orbit preview at 262k on torch 2.15.0 (black or a crash on 2.12.1).' },
  { post: '2026-10-23-torch-2.15-mps-inv-and-wan', src: `${M}/2026-10-23_torch-2.15-mps/torch215-wan-s0.8-seed7/*_00001_.mp4`, out: 'torch215-wan-s0.8-seed7.mp4', caption: 'Wan VACE 17 frames on torch 2.15.0, strength 0.8, seed 7.' },

  // Experiment 009
  { post: '2026-10-27-m1-batch-01-small-templates', brief: true, src: `${M}/2026-10-27_m1-batch-01/contact-sheet.jpg`, out: 'contact-sheet.jpg', caption: 'M1 batch 01: all image outputs.' },
  { post: '2026-10-27-m1-batch-01-small-templates', src: `${M}/2026-10-27_m1-batch-01/sdpose-sam3-bbox.jpg`, out: 'sdpose-sam3-bbox.jpg', caption: 'Top: input and SAM3 alpha without bbox. Bottom: SDPose without bbox and SAM3 alpha with bbox.' },
  { post: '2026-10-27-m1-batch-01-small-templates', src: `${M}/2026-10-27_m1-batch-01/utility_sdpose_ood_image_to_pose.street-nobbox/*_00001_.png`, out: 'sdpose-street-nobbox.png', caption: 'SDPose on the street frame, no bbox: skeleton.' },
  { post: '2026-10-27-m1-batch-01-small-templates', src: `${M}/2026-10-27_m1-batch-01/utility_depth_anything3_video_depth_estimation/*_00001_.mp4`, out: 'depth-anything3-video.mp4', caption: 'Depth Anything 3 video depth estimation on the Unity clay video.' },
  { post: '2026-10-27-m1-batch-01-small-templates', src: `${M}/2026-10-27_m1-batch-01/utility_video_frame_interpolation/*_00001_.mp4`, out: 'frame-interpolation.mp4', caption: 'Video frame interpolation on the Unity clay video.' },

  // Experiment 010
  { post: '2026-10-27-k1-vace-strength-matrix', brief: true, src: `${M}/2026-10-27_k1-vace-strength/k1-grid.jpg`, out: 'k1-grid.jpg', caption: 'K1 matrix: strength 0.50–0.75 × 3 styles, seed 7; tiles labelled with depth MAE.' },
  ...['rain', 'noon', 'anime'].flatMap((style) => ['0.50', '0.75'].map((s) => ({
    post: '2026-10-27-k1-vace-strength-matrix',
    src: `${M}/2026-10-27_k1-vace-strength/k1-${style}-s${s}-seed7/*_00001_.mp4`,
    out: `k1-${style}-s${s}.mp4`,
    caption: `Style “${style}”, strength ${s}, seed 7.`,
  }))),

  // Experiment 012
  { post: '2026-11-03-m1-batch-02-video-3d-templates', src: `${M}/2026-11-03_m1-batch-02/sdpose-multi-sample.jpg`, crop: 'iw/2:ih:0:0', out: 'sdpose-multi-sample-pose.jpg', caption: 'SDPose multi-person on the template’s sample photo of about 8 people: one detection (the template ships max_detections = 1). Pose map only; the sample photo is not reproduced.' },
  { post: '2026-11-03-m1-batch-02-video-3d-templates', brief: true, src: `${M}/2026-11-03_m1-batch-02/utility_seedvr2_3b_int8_upscale_image/*_00001_.png`, out: 'seedvr2-upscale-unity.jpg', caption: 'SeedVR2 3B int8 image upscale of the Unity frame.' },

  // Experiment 013
  { post: '2026-11-10-m1-batch-02bc-supervisor-node-compat', brief: true, src: `${M}/2026-11-10_m1-batch-02bc/video_wan2.1_fun_camera_v1.1_1.3B/*_00001_.mp4`, out: 'wan-fun-camera-unity.mp4', caption: 'Wan 2.1 Fun Camera v1.1 1.3B, “Zoom In” on the Unity street frame (512², 81 frames, 17.9 min).' },
  { post: '2026-11-10-m1-batch-02bc-supervisor-node-compat', src: `${M}/2026-11-10_m1-batch-02bc/text_to_video_wan/*_00001_.mp4`, out: 'wan-t2v.mp4', caption: 'Wan 2.1 text-to-video at template defaults (832×480, 33 frames, 12.3 min).' },
  { post: '2026-11-10-m1-batch-02bc-supervisor-node-compat', seq: true, fps: 16, src: `${M}/2026-11-10_m1-batch-02bc/wan2.1_fun_control/*_.png`, out: 'wan-fun-control-frames.mp4', caption: 'The 81 control frames Wan Fun Control saved before it timed out (encoded from the PNG sequence).' },

  // Experiment 014
  { post: '2026-11-13-m1-batch-02d-runner-cancel-quiet-slow', brief: true, src: `${M}/2026-11-13_m1-batch-02def/video_wan2.1_fun_camera_v1.1_1.3B@sample/*_00001_.mp4`, out: 'wan-fun-camera-sample.mp4', caption: 'Wan 2.1 Fun Camera v1.1 1.3B on the template’s sample start image (512², 81 frames, 18.1 min).' },
  { post: '2026-11-13-m1-batch-02d-runner-cancel-quiet-slow', src: `${M}/2026-11-13_m1-batch-02def/utility_sdpose_ood_video_to_pose_map@sample/*_00001_.mp4`, out: 'sdpose-video-sample.mp4', caption: 'SDPose video pose map on the template’s sample clip: walking skeleton (1024 px).' },
  { post: '2026-11-13-m1-batch-02d-runner-cancel-quiet-slow', src: `${M}/2026-11-13_m1-batch-02def/sdpose-sample-contact-sheet.png`, out: 'sdpose-sample-contact-sheet.png', caption: 'Contact sheet of the sample-clip pose map.' },
  { post: '2026-11-13-m1-batch-02d-runner-cancel-quiet-slow', src: `${M}/2026-11-13_m1-batch-02def/utility_sdpose_ood_video_to_pose_map/*_00001_.mp4`, out: 'sdpose-video-unity.mp4', caption: 'SDPose video pose map on the Unity clay clip (832 px).' },
  { post: '2026-11-13-m1-batch-02d-runner-cancel-quiet-slow', seq: true, fps: 16, src: `${M}/2026-11-13_m1-batch-02def/utility_video_segment_sam3/*_.png`, out: 'sam3-masks-unity.mp4', caption: 'SAM3 video masks on the Unity clay clip (81 frames, encoded from the PNG sequence). Called “nearly empty” on 2026-11-13; corrected on 2026-11-17: they select the mannequin, median IoU 0.86 against Unity’s segmentation pass.' },
  { post: '2026-11-13-m1-batch-02d-runner-cancel-quiet-slow', seq: true, fps: 16, src: `${M}/2026-11-13_m1-batch-02def/utility_video_segment_sam3@sample/*_.png`, out: 'sam3-masks-sample.mp4', caption: 'SAM3 video masks on the template’s sample clip (160 frames, encoded from the PNG sequence).' },

  // Experiment 015
  { post: '2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats', brief: true, src: `${M}/2026-11-17_m1-batch-02ghi/frame40-clay-groundtruth-sam3person-sam3car-sdpose832.png`, out: 'frame40-comparison.png', caption: 'Frame 40: clay, Unity segmentation, SAM3 “person” mask / SAM3 “car” mask, SDPose pose, clay.' },
  { post: '2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats', seq: true, fps: 16, src: `${M}/2026-11-17_m1-batch-02ghi/sam3_video_unity_person/*_.png`, out: 'sam3-unity-person.mp4', caption: 'SAM3 video masks on the Unity clay clip, prompt “person” (encoded from the PNG sequence).' },
  { post: '2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats', seq: true, fps: 16, src: `${M}/2026-11-17_m1-batch-02ghi/sam3_video_unity_car/*_.png`, out: 'sam3-unity-car.mp4', caption: 'Same clip, prompt “car”: it also selects the mannequin.' },
  { post: '2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats', src: `${M}/2026-11-17_m1-batch-02ghi/sdpose_multi_person_video_832/*_.mp4`, out: 'sdpose-multi-unity-832.mp4', caption: 'SDPose multi-person video on the Unity clay clip at 832×480: 8 of 81 frames have no pose.' },
  { post: '2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats', seq: true, fps: 24, src: `${M}/2026-11-17_m1-batch-02ghi/utility_sdpose_multi_person_video@sample/*_.png`, out: 'sdpose-multi-sample-pose.mp4', caption: 'SDPose multi-person video pose map on the template’s sample clip (1024², 121 frames; pose maps only, encoded from the PNG sequence).' },

  // Experiments 007 and 011 produced no images: one figure each, drawn from their results.
  { post: '2026-10-23-e2-frontend-vs-cli-conversion', gen: 'e2Templates', out: 'e2-20-templates.svg', caption: 'Outcome of the 20-template comparison (figure drawn for publication from the counts in this note).' },
  { post: '2026-11-03-torch-2.15-ga-wheel-check', gen: 'invStatus', out: 'linalg-inv-by-size.svg', caption: 'The linalg.inv repro per batch size: torch 2.12.1 (Experiment 008) against the 2.15.0 GA wheel (figure drawn for publication from the recorded result files).' },
];
