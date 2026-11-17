---
title: "Experiment 015 — odd-size pre-flight, mask check with Unity ground truth, stuck-at-step label; M1 batch 02g/02h/02i; MoGe panorama repeats"
date: "2026-11-17"
tags: ["unity-comfy"]
run: "scheduled run 2026-11-17_0700"
summary: "Follows Experiment 014 (lab note), whose \"Next\" list was: SDPose multi-person video; a pre-flight check for odd video dimensions; an \"empty mask\" check; MoGe panorama repeated in one session."
media: [{"src":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/frame40-comparison.png","kind":"image","caption":"Frame 40: clay, Unity segmentation, SAM3 “person” mask / SAM3 “car” mask, SDPose pose, clay."},{"src":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sam3-unity-person.mp4","kind":"video","caption":"SAM3 video masks on the Unity clay clip, prompt “person” (encoded from the PNG sequence).","poster":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sam3-unity-person.poster.jpg"},{"src":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sam3-unity-car.mp4","kind":"video","caption":"Same clip, prompt “car”: it also selects the mannequin.","poster":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sam3-unity-car.poster.jpg"},{"src":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sdpose-multi-unity-832.mp4","kind":"video","caption":"SDPose multi-person video on the Unity clay clip at 832×480: 8 of 81 frames have no pose.","poster":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sdpose-multi-unity-832.poster.jpg"},{"src":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sdpose-multi-sample-pose.mp4","kind":"video","caption":"SDPose multi-person video pose map on the template’s sample clip (1024², 121 frames; pose maps only, encoded from the PNG sequence).","poster":"media/2026-11-17-m1-batch-02ghi-size-preflight-mask-check-moge-repeats/sdpose-multi-sample-pose.poster.jpg"}]
---

Follows Experiment 014 ([lab note](../2026-11-13-m1-batch-02d-runner-cancel-quiet-slow/)),
whose "Next" list was: SDPose multi-person video; a pre-flight check for odd video dimensions; an
"empty mask" check; MoGe panorama repeated in one session.

## Setup

- M5 Pro, 48 GB. ComfyUI 0.38.2, torch 2.12.1 (MPS), templates 0.11.74 (`/system_stats`). Started with
  `scripts/comfy-start.sh` (faulthandler on), stopped at the end by the pid on port 8188.
- Runner: `scripts/comfy-runner.py ... --restart-cmd scripts/comfy-start.sh`. Jobs did not set
  `free_before`; the MoGe repeats were separated by a POST to `/free` (unload models, free memory) so
  that ComfyUI's cache would not return the previous result.
- Specs: `workflows/m1/batch-02g.json` (SDPose multi-person video, both input sets), `batch-02h.json`
  (MoGe panorama, Unity frame; five runs made from it), `batch-02i.json` (SDPose multi-person video and
  SAM3 video on the Unity clip; four jobs made from it). Data: `raw/assets/experiments/2026-11-17-m1-batch-02g/`,
  `-02h/`, `-02i/`, `-mask-check/`, `-runner/`.
- Unity inputs: `uc_demo_street_clay.mp4` (832×480, 81 frames, 16 fps), `uc_demo_street_beauty_00040.png`;
  ground truth from `UnityComfy/Captures/demo_street/segmentation/` (mannequin colour 217,37,214; it
  covers 0.55–3.14% of the frame, median 1.32%).
- Media (local): `media/2026-11-17_m1-batch-02ghi/`.
- No model downloads. The server was killed and restarted by the runner three times (ignored cancels) and
  crashed once (segfault); see MoGe below.

## Code changes

1. **Odd-size pre-flight** (`scripts/size_preflight.py`, called from the runner's `preflight`). It
   propagates the frame size through the API prompt from the loaders (ffprobe on the input file) to each
   `SaveVideo`, using only known rules: `GetVideoComponents`, `CreateVideo`, `ResizeImageMaskNode` in the
   modes "scale longer dimension", "scale shorter dimension" (same rounding as ComfyUI 0.38.2's
   `nodes_post_processing.py`) and "scale dimensions", and a short list of pass-through nodes. A predicted
   H.264 frame size with an odd side makes the job `refused` before anything is queued. A size it cannot
   predict (unknown node or resize mode, missing input file, AV1) is never refused.
   - Tests: `scripts/test_size_preflight.py`, **9 of 9** (probe faked).
   - Against the real failure: predicted 1024×591 for the Unity clip; the PNG frames the failed job
     saved are 1024×591. Predicted 1024×1024 for the sample clip (704×704); the saved video is 1024×1024.
2. **Mask check** (`scripts/validate-output.py --kind mask`, job key `expect.kind = "mask"`, optional
   `expect.mask_frac = [lo, hi]`). The black, flat and frozen checks are replaced by `mask_coverage`:
   the fraction of pixels above luma 127 must lie in the range on every frame (default 0.001–0.98, which
   only catches an empty or a whole-frame mask). Like the other V1 checks it is measured on frames
   downscaled to 96 px wide, so coverage of very small masks is approximate.
   - Tests: 5 new cases in `scripts/test_validate_output.py` (blob, empty, whole frame, wrong size
     against a given range, still mask video); **16 of 16** in the file.
3. **Mask against ground truth** (`scripts/mask-seq-iou.py MASK_DIR SEG_DIR --rgb R,G,B`). Per-frame IoU,
   precision, recall and coverage of a mask sequence against one object's colour in Unity's
   segmentation pass, plus which segmentation colour each mask overlaps most. Not yet called by the
   runner; run by hand below.
4. **Stuck-at-step label** (runner). Found in this run: MoGe panorama sat at step 50 of 69 for 12 minutes
   and the timeout was labelled `too-slow` ("about 3 min of sampling in total"), because the label only
   needed two timed steps. Now `too-slow` needs a step event within max(5 steps' time, 60 s) of the
   timeout; otherwise the label is `stuck-at-step` with `since_last_step_s` and no projection.
   - Tests: new fake-server mode `stuck`; `scripts/test_runner_fake.py` **6 of 6**
     (`raw/assets/experiments/2026-11-17-runner/fake-server-cases.json`). Integration
     `scripts/test_comfy_runner.py --quick` **10 of 10** after all changes.
   - Live: MoGe repeats 1 and 2 ran before the fix (labelled `too-slow`); repeat 5 ran after it and was
     labelled `stuck-at-step` ("no step since 50/69 for 788 s").

## Run results

| Job | Input | Result | Time | Notes |
| --- | --- | --- | --- | --- |
| utility_sdpose_multi_person_video | sample (`man_playing_violin.mp4`, 704×704) | **passed** | 323.6 s | 121 pose PNGs 1024², every frame lit (median 2.46% of pixels), plus the overlay video |
| utility_sdpose_multi_person_video | Unity clay clip, template default (longer side 1024) | **error** at SaveVideo, before the pre-flight existed | 112 s wall | `av.error.ExternalError: avcodec_open2("libx264")`; frames are 1024×591. Same fault as SDPose video on 2026-11-13 |
| same, rerun after the pre-flight | Unity clay clip | **refused** | 0 s | "preflight: node 697 SaveVideo: predicted frame size 1024x591 has an odd side"; nothing queued |
| same, longer side 832 (`688.value = 832`) | Unity clay clip | **rejected** | 105.9 s | 832×480. 73 of 81 frames have a skeleton; 8 have none (frames 0, 8, 9, 18, 19 and three later ones; lit fraction below 0.0005 at full resolution; the runner's downscaled check failed 7). The person detector (`RTDETR_detect`, class "person", threshold 0.5) feeds the pose step; whether it or the pose step drops the frames was not separated |
| utility_video_segment_sam3, prompt "person" | Unity clay clip | **passed** (`kind: mask`) | 175.7 s | 81 masks, coverage 0.43–2.81% (downscaled). Against the mannequin: IoU median 0.862 (min 0.828), precision 0.987, recall 0.872 |
| utility_video_segment_sam3, prompt "car" (meant as a control with nothing to find) | Unity clay clip | **rejected** | 172.4 s | 2 of 81 frames below 0.1% coverage. On 77 of 81 frames the mask is still the mannequin (IoU median 0.870); on 4 frames it overlaps a different object most and IoU is 0 on at least one |
| 3d_moge_panorama_to_mesh ×5 | see below | 0 of 5 passed | | |

**Correction to Experiment 014.** Its SAM3 video result on the Unity clip (template prompt "unicorn") was
recorded as "masks nearly empty … content not meaningful". Scored today against Unity's segmentation
pass, those same 81 masks select the mannequin: IoU median 0.864 (min 0.832, max 0.940), precision
0.988, recall 0.873 (`raw/assets/experiments/2026-11-17-mask-check/sam3-unicorn-prompt-vs-mannequin.json`).
The masks are small because the mannequin is small (1.3% of the frame), not because nothing was found.
With "unicorn", "person" and "car" all giving the same object, the text prompt did not decide what
SAM3 selected in this scene.

Batch 02 status after this run (12 templates): 8 have passed on at least one input set (adds SDPose
multi-person video, sample input). MoGe panorama is counted in the 8 on the strength of one pass
(2026-11-13) that has not been reproduced. Still failing: SAM 3D Body, Wan Fun Control, SeedVR2 video,
TripoSplat.

## MoGe panorama: five runs (`raw/assets/experiments/2026-11-17-m1-batch-02h/`)

| Run | Variant | Result | Wall | What happened |
| --- | --- | --- | --- | --- |
| r1 | Unity frame 832×480, template defaults | timeout | 931 s | Inference 12/12, merge reached "solving 832x480" (step 50/69) and stayed there. 5 quiet-but-busy deferrals (1.0 core). Cancel ignored (30.7 s); server killed by port pid, back in 4.3 s |
| r2 | same, fresh server process | timeout | 931 s | Same place. 6 deferrals. Cancel ignored; restart 4.5 s |
| r3 | same, `merge_resolution` 416 | error | 115 s | The merge finished; `MoGePointMapToMesh` raised "MoGe produced an empty mesh; try discontinuity_threshold=0 or apply_mask=False." |
| r4 | template's own input `lego_street_panorama.png` (2048×1024), defaults | server crash | 27 s | "Fatal Python error: Segmentation fault" in `torch.nn.functional.grid_sample`, called from `comfy/ldm/moge/panorama.py` `split_panorama_image` (trace: `moge-r4-segfault-trace.txt`). Runner: "crashed … not resubmitted"; server restarted |
| r5 | Unity frame, defaults again | timeout | 930 s | Same place as r1 and r2. Labelled `stuck-at-step` |

- Where the hang is: a 5-second process sample during r1 (`moge-r1-process-sample-top-of-stack.txt`)
  shows the busy thread in `csr_matvec` (SciPy sparse matrix × vector) and NumPy arithmetic. The merge
  code calls `lsmr(A, b, atol=1e-5, btol=1e-5, x0=x0, show=False)` (`comfy/ldm/moge/panorama.py` line
  306) with no `maxiter`, on one CPU core. So the "hang" is an iterative sparse solve that has not met
  its tolerance, not a deadlock. That it would finish if left longer was not tested.
- The code comment at `nodes_moge.py` line 198 says pixels no view predicts as foreground "are
  unconstrained in the lsmr solve". Our input is an ordinary 832×480 frame fed to a panorama template,
  so this may apply; not verified.
- History of the default job on the Unity frame: segfault (2026-11-03), hang (2026-11-10), pass in 59 s
  (2026-11-13), hang ×3 (today). Today's three hangs were in three different server processes, one of
  them after other jobs and two fresh, so warm or cold state did not change the outcome today. What made
  2026-11-13 pass is still unknown.
- The ignored-cancel path (kill by port pid, restart) ran on a real job for the first time: 3 of 3.

## Observations

- The pre-flight turns a failure after 112 s of work into a refusal at 0 s, but only for graphs whose
  size it can follow. It knows one resize node and nine pass-through node types.
- "Non-empty mask" is a weak check: the "car" control produced plausible masks of the wrong prompt's
  object. Coverage catches empty and whole-frame masks; IoU against the engine's segmentation pass is
  the check that says whether the right thing was selected, and Unity inputs make it free.
- For pose frames the runner validates each PNG on its own, so one frame without a detection rejects
  the job. That is the right verdict for a control video (8 dropped frames would flicker), but the
  ledger does not say "73 of 81" in one place; the count above was computed by hand.
- The overlay video that SDPose multi-person saves is judged with `kind: pose` too and passes trivially
  (it is the source video blended with the skeleton, 65–93% lit).

## Next

- A per-sequence summary in the ledger for image-sequence outputs (frames passing / total).
- Call `mask-seq-iou.py` from the runner when a job names a segmentation directory and colour.
- SDPose multi-person on the Unity clip: find which step drops the 8 frames (detector threshold or pose).
- MoGe panorama: stop repeating it on 0.38.2; re-test on the upgraded copy (ComfyUI 0.45.0 + torch
  2.15.0) if the upgrade test goes ahead. A timing run of the lsmr solve outside ComfyUI would
  settle whether it converges.
