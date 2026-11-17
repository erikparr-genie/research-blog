# AI Video Research Notes

Source of the public research blog at **https://erikparr-genie.github.io/research-blog/**.

An ongoing, partly agent-run research log on blockout-driven AI video (Unity blockout → ComfyUI
video models) and agent-directed shot production. Two kinds of post:

- **Run briefs** (`src/content/briefs/`): one per scheduled research run that wrote a brief.
- **Experiments** (`src/content/experiments/`): the lab notes, with media in `public/media/`.

The site is static ([Astro](https://astro.build), Node 22.23+ / tested on Node 26) and is built and
deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Adding posts after a new research run

Posts and media are generated from the private research repo by an import script. The source repo
is only read, never written.

```sh
npm install
npm run import      # regenerate src/content/** and public/media/** from the sources
npm run build       # build to dist/
npm run check       # link, media and scrub checks on dist/
npm run preview     # look at it locally
git add -A && git commit -m "Import run YYYY-MM-DD" && git push   # deploys
```

`npm run import` expects the research repo next to this one (`../ai-video-production`); set
`RESEARCH_SRC=/path/to/ai-video-production` if it lives elsewhere. It needs `ffmpeg` and `ffprobe`
on the PATH. It rewrites every post on each run, so do not edit files under `src/content/` by hand:
change the rules instead.

After a new run, the usual steps are:

1. Run `npm run import`. New briefs and lab notes are picked up automatically.
2. Read the `warn: review …` lines. They list text that may still be addressed to the author
   ("you", "your", a first name). Add an exact replacement to `scripts/edits.mjs` for anything that
   should not be published as is, and rerun.
3. To publish media for a new experiment, add entries to `scripts/media-manifest.mjs` (source path
   in the research repo, published file name, caption) and rerun. Existing media files are kept;
   `FORCE_MEDIA=1 npm run import` re-creates them all.
4. `npm run build && npm run check`, then commit and push.

### What the import includes

- `agent/runs/<run>/brief.md` and `branches/*/agent/runs/<run>/brief.md`. A run whose brief is only
  a crash notice ("did not produce a brief") gets no post.
- `branches/*/raw/sources/experiments/*.md`.
- The media listed in `scripts/media-manifest.mjs`: highlight clips, contact sheets and grids.
  Videos are H.264 / yuv420p mp4 with a poster frame; PNG frame sequences are encoded to mp4.

Not published: wiki pages, paper summaries, research plans, runner-test fixture clips, raw
per-frame dumps, 3D files, and outputs that show third-party sample photos or footage of people.

### What the import removes

- The "Decisions needed" and "Budget" sections of briefs, mail-handling lines, pointers to local
  media folders, and "next run" items that depend on a removed decision.
- Links into the private repos: a link to a published lab note becomes a site link, any other
  becomes plain text (the bare URL is dropped).
- Local paths: home-directory paths are rewritten to `$COMFY_INSTALL`, `$COMFY_MODELS` or `$HOME`.
- All metadata embedded in media files (ComfyUI stores the full workflow in its outputs).
- Sentences addressed to the author, listed one by one in `scripts/edits.mjs`.

The import fails if an email address, a home path, a private-repo link, a credential-like string
or one of a few other patterns is left in a generated post. `npm run check` repeats those checks on
the built site, including strings inside media files, and verifies every internal link and media
reference.

## Layout

```
scripts/import.mjs           import + scrub
scripts/edits.mjs            per-file text edits for publication
scripts/media-manifest.mjs   which media files are published, with captions
scripts/check.mjs            checks on the built site
src/content/                 generated posts (committed)
public/media/                generated media (committed)
src/                         Astro pages, layouts, styles
```

Mermaid diagrams are not set up because no source uses them yet.
