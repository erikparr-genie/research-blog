---
title: "Experiment 007 — E2: headless frontend Save (API) vs comfy-cli conversion (M0 set + 20 templates; comfy-cli 1.22 → 1.23)"
date: "2026-10-23"
tags: ["unity-comfy"]
method: "Unattended research run 2026-10-23_0700. Local ComfyUI 0.38.2, frontend 1.53.6, Google Chrome headless driven over the DevTools protocol. comfy-cli 1.22.0, then 1.23.0, in its own venv. Nothing was queued (checked with /api/jobs before and after)."
summary: "The last M0 exit item, E2: diff the comfy-cli UI → API conversion against what the frontend's Save (API) produces. Earlier runs skipped it because \"it needs a browser session\". If it worked, the plan was to also run the…"
---

## Goal

The last M0 exit item, E2: diff the comfy-cli UI → API conversion against what the frontend's
**Save (API)** produces. Earlier runs skipped it because "it needs a browser session".
If it worked, the plan was to also run the P1-phase version: 20 templates.

## Method: `scripts/frontend-api-export.py`

- Starts Google Chrome headless with a throwaway profile and opens the local frontend
  (`http://127.0.0.1:8188`, frontend 1.53.6).
- Waits for `window.app`, loads the UI workflow with `app.loadGraphData(wf, true, true)` and
  returns `(await app.graphToPrompt()).output`. Save (API) writes the same object.
- Talks to Chrome over the DevTools protocol with aiohttp from the ComfyUI venv. No Playwright
  needed.
- **Diff:** node ids, class_type and every input, with link refs normalised to
  `[node_id, slot]`. Exit 1 on any difference.
- **Repeatability:** two exports of the same workflow were byte-identical.
- **Negative control:** a copy of the BiRefNet export with one widget value changed and one node
  dropped → `differences: 2`, exit 1.
- Both tools only convert. `/api/jobs` was the same before and after, with the last job still the
  TripoSplat run of Experiment 006.

## M0 set

| Workflow | Frontend nodes | Differences vs comfy-cli |
| --- | --- | --- |
| #2 `utility_birefnet_remove_background` | 7 | **0** |
| #3 `3d_triposplat_image_to_gaussian_splat` | 23 | 2, both benign |

The two TripoSplat differences:
- `SaveVideo.codec`: the frontend sends `"auto"`, comfy-cli omits it. In `/object_info` it is an
  *optional, hidden* dynamic combo whose first option is `auto`.
- `SaveGLB.image`: the frontend sends `""`, comfy-cli omits it. `SaveGLB` declares no `image`
  input at all (required: mesh, filename_prefix).

#1 (Wan VACE) was written in API format from the start (Unity client). There is no UI workflow,
so E2 does not apply to it.

## 20 templates

- **Sample:** 20 templates drawn with a fixed seed (20261023) from the 292 installed templates
  (templates 0.11.74) that have no `api_` prefix or API-node marker.
- **Results** (`batch-cli122.json`, `batch-cli123.json`):
  - **12/20 identical.** Node counts matched in all 20.
  - **comfy-cli 1.23.0 produced byte-identical prompts to 1.22.0 for all 20, and for the two M0
    templates.** The 1.23 widget/slot fixes didn't change any conversion in this sample.

Differences, classified:

| Template | Difference | Material? |
| --- | --- | --- |
| 4 video templates | `SaveVideo.codec` "auto" vs omitted | No (optional, default auto) |
| `templates_mjm_image_to_3d` | `Preview3D.image`, `SaveGLB.image` "" vs omitted | No (undeclared inputs) |
| `utility_interpolation_image_upscale` | `ImageCompare.compare_view` `{"__value__":["",""]}` vs null | No (preview-only node) |
| `audio_stable_audio_3_medium` | `CustomCombo` option1–5 and index sent by the frontend only | No (the server declares only `choice`) |
| `video_wan2_2_14B_s2v` | 3 nodes with different subgraph-instance ids (85:182–184 vs 85:76–78) | No: after mapping ids the graphs are identical except `codec` |
| `utility_image_segment_sam3` | `SAM3_Detect.bboxes`: comfy-cli sends `{"x":0,"y":0,"width":512,"height":512}`, the frontend omits it | **Possibly.** comfy-cli injects the schema default of a socketless, force-input *optional* input. If SAM3 honours it, detection is limited to a 512×512 box the UI user never set. |
| `template_image_speech_to_video` | `CLIPTextEncode.text` (node 478:306): the frontend sends `""`, comfy-cli links it to `478:319` (the "Prompt" primitive) | **Yes:** different positive prompt |

**Root cause of the material case:**
- In the template, link 746 comes from `TextGenerateLTX2Prompt` (node 342), which is **bypassed**
  (mode 4) inside the "Video Generation (LTX-2.3)" subgraph.
- Bypass semantics pass a node's same-type input through. Here the STRING `prompt` input comes
  from node 319.
- comfy-cli does that and wires `text ← 478:319`. The headless frontend export instead falls back
  to the empty widget value. Its `478:319` node is exported but nothing consumes it.
- **So the frontend export, not comfy-cli, loses the prompt here.** Not confirmed in an
  interactive browser. It could be an artifact of loading through `loadGraphData` headless, but
  no other template shows it.

## Observations

- Save (API) no longer needs a person. Headless Chrome over CDP gives the reference conversion
  in about 3–6 s per template.
- The frontend is not a perfect reference. Here it was wrong (the bypass case), and in 7 cases it
  sends extra, unused UI fields. E2 should classify differences, not treat any difference as a
  converter error.
- The two material cases share a cause: values that do not exist as widgets in the UI
  (passthrough of a bypassed node; a socketless default). Both are worth a check of their own when
  converting templates.

## Status against the M0 exit

- **E2: done for the M0 set** (#2 identical; #3 two benign differences; #1 not applicable).
  Batch of 20 done: 12 identical, 6 benign, 2 material (1 frontend-side, 1 comfy-cli-side).
- With Experiments 005 and 006, **every M0 exit item now has a measured result.**
- Install change: comfy-cli in `$COMFY_INSTALL/cli-venv` upgraded 1.22.0 → 1.23.0.
