---
title: "Experiment 011 — torch 2.15.0 GA wheel vs the Experiment 008 build; linalg.inv repro on GA"
date: "2026-11-03"
tags: ["unity-comfy"]
run: "scheduled run 2026-11-03_0700"
summary: "Question. torch 2.15.0 went GA on 28 Oct (PyPI upload 2026-10-28T15:16:35). Experiment 008 (2026-10-23) measured a 2.15.0 build from whl/test and the wiki assumed it \"most likely was the Final RC\". Is the test venv's…"
media: [{"src":"media/2026-11-03-torch-2-15-ga-wheel-check/linalg-inv-by-size.svg","kind":"image","caption":"The linalg.inv repro per batch size: torch 2.12.1 (Experiment 008) against the 2.15.0 GA wheel (figure drawn for publication from the recorded result files).","thumb":"media/2026-11-03-torch-2-15-ga-wheel-check/linalg-inv-by-size.svg"}]
---

**Question.** torch 2.15.0 went GA on 28 Oct (PyPI upload 2026-10-28T15:16:35). Experiment 008
(2026-10-23) measured a `2.15.0` build from `whl/test` and the wiki assumed it "most likely was the
Final RC". Is the test venv's build the GA build, and does the `linalg.inv` fix hold on GA?

## Setup

- Mac M5 Pro, 48 GB, macOS 26.5.1 (above the new macOS 15 floor for MPS in 2.15).
- GA wheel downloaded from PyPI's JSON API: `torch-2.15.0-cp312-cp312-macosx_14_0_arm64.whl`,
  138,558,517 bytes, sha256 `593e5fd0c204284890d1c3dff643be34e549e1d24523e13402510f960d4da438`
  (matches PyPI's published digest).
- Compared the wheel's `RECORD` with the installed `RECORD` in
  `$COMFY_INSTALL/torch215-venv` (Experiment 008's venv).
- New venv `$COMFY_INSTALL/torch215ga-venv` (Homebrew Python 3.12.13), GA wheel
  installed `--no-deps` from the verified file, plus torch's pure-Python deps and numpy
  (`torch215ga-venv-freeze.txt`). ComfyUI's own venv is untouched (still torch 2.12.1).
- `scripts/mps-inv-repro.py` with default sizes, float32.

## Results

**The Experiment 008 build is not the GA build.**

| | `torch.version.git_version` |
| --- | --- |
| test venv (Exp 008, `whl/test`, 23 Oct) | `ef10301d9fdf0feb4b2c81149d5b038a1b4b8094` |
| PyPI GA (28 Oct) | `d0f2af8b66b20da4baa50644c0cd3f887a2eae2e` |

- Both report `torch.__version__ == "2.15.0"`.
- `RECORD` differs in 9 package files beyond metadata, including `torch/lib/libtorch_cpu.dylib`
  (same size, different hash), `torch/__init__.py`, `torch/_dynamo/convert_frame.py`,
  `torch/_inductor/codecache.py` (`record-diff-ga-vs-test-venv.txt`).
- Whether `ef10301d` was the "Final RC" of 21 Oct is not verified.

**`linalg.inv` on GA: fixed at every size** (`torch-2.15.0-ga-inv.json`).

| N | max rel. error | zero fraction | ok |
| --- | --- | --- | --- |
| 1,024 | 4.2e-7 | 0 | yes |
| 16,384 | 7.7e-7 | 0 | yes |
| 65,536 | 1.1e-6 | 0 | yes |
| 131,072 | 1.1e-6 | 0 | yes |
| 262,144 | 1.1e-6 | 0 | yes |

Same errors as Experiment 008 on the RC build (torch 2.12.1: zeros at 65k–131k, abort at 262k).

## Observations

- Timings (1.3–2.5 s per size) are not comparable with Experiment 008 (65–183 ms): the machine was
  busy with model downloads, ComfyUI and two unrelated processes at \~150% CPU each. The repro checks
  correctness, not speed.
- Not re-measured on GA: Wan speed (Exp 008: \~1.9× faster than 2.12.1) and TripoSplat. Those carry
  over only by inference until the M1 upgrade point re-baselines them.
- For the K4 manifest: identify a torch build by `git_version` or wheel sha256, never by the
  version string.
