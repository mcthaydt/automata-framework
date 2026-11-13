# Site read-through, 2026-11-13

The Owner reads the built site from `main` and reports what is wrong, one finding at a time. Each finding is one commit on
`claude/site-readthrough`. Pictures are Chromium against the built site, reduced motion (a still frame), at phone 390×844
and desktop 1280×800, 2× scale; the "before" pictures are `origin/main` at `a234a3a20`.

## Finding 1: "the code does not match the demo"

**Where:** Home, "Built for agents" ("Made for Claude Code, Cursor and Codex.").

**The Owner's words:** "the code does not match the demo".

**Cause.** Two separate defects.

1. The code was a sixteen-line excerpt of `examples/2d/shapes/shapes-rects.ts` written by hand into `home-content.ts`: one
   component (`Block`), a `move` that only moves blocks, and a `defineGame` with one view and no `setup`. The picture under it
   draws the whole example: four blocks, a sliding bar and a spinner. So the code named one of three things and, as written,
   would have drawn nothing (no `setup`, so no entity). The old test only asked that each excerpt line be somewhere in the file.
2. The picture is a hand-written canvas drawing (`ShapesPreview.svelte`) that re-implements the example's rules, so nothing
   but a comment kept the two together. Its only test compared hex colours.

**Fix.**

- The code beside the picture is now the file itself, whole: `shapes-rects.ts` minus its header comment, read at build time by
  `src/shared/framework/home-example.ts` and served as `virtual:framework/home-example`. Nothing of it is written in the
  site. It starts at the `import` line, so it runs as written.
- It is a declared scroll region (`role=region`, `tabindex=0`, named "The example's code, whole") with a set height (22 rem on
  desktop, 16 rem on a phone). No line is cut.
- The build now checks it: `check:site` fails when Home's built code is not the file's code byte for byte
  (`checkHomeExample`).
- Preview: **kept as a drawing, now held to the real sim.** The drawing's numbers moved to `shapes-model.ts`; a test runs the
  example's own sim headless for 2,500 ticks and compares every block, the bar and the spinner with `stateAt(tick)` at every
  tick (positions exactly; the angle within 0.01 rad, because the sim keeps it in 32 bits and adds 0.05 each tick), and holds
  the sizes, colours, anchor, world size and spawn points to the example's text. The test fails if either side moves.
- Why not run the framework on Home: Home's preloaded script budget is 48,000 bytes and had 54 bytes of room, and the
  runtime that plays an example (`build/playground/runtime/assets`, measured) is 1.48 MB of script, 426 kB gzipped; running
  it would have meant loading that on the first screen of the site for a picture below the fold. Home already has the real game (the Emberwick demo, on Play) and the
  Examples pages run the real example.
- Budget: showing the whole file added 1.3 kB to Home's page chunk (47,946 → 49,260 bytes preloaded, over the 48,000
  budget). The drawing is below the first screen, so its code is now its own chunk, fetched after the page is live. Preloaded
  script is now 47,991 bytes (9 bytes of room: the next addition to Home's chunk has to make room the same way).

**Tests (written first, watched fail for the right reason):**
`tests/unit/home/home.test.ts` ("shows the example's whole code…"), `tests/unit/home/shapes-parity.test.ts` (new; mutation
checked: changing the bar's speed or the spinner's step fails it), `tests/unit/scripts/site-checks.test.ts`
(`checkHomeExample`), `tests/e2e/site.e2e.ts` ("the shapes example on Home…", phone and desktop: the region is focusable and
tall, End reaches the last line, the canvas shows the example's blue, green and red, no sideways scroll).
`tests/unit/home/shapes.test.ts` (colours only) is deleted: the parity test holds the same colours and everything else.

**Pictures:** before `f1-before-phone.png`, `f1-before-desktop.png`; after `f1-after-phone.png`, `f1-after-desktop.png`.
(The desktop element pictures show the sticky header over the top of the panel; it is the capture, not the page.)

**Open for the Owner:** on a phone only the first eleven or so lines show at once and long lines scroll sideways. There is no
printed hint that the code scrolls; the cut-off line at the bottom is the cue. Say if you want a visible hint.

### Same class of defect, everywhere on Home and the Docs landing

Checked each place that shows code beside a picture, a number beside a claim, or a command beside its output. (Filled in as
each is judged; a mismatch becomes its own finding below.)

## Finding 3: `check:launch` crashes before it checks anything

**Where:** `pnpm --filter @automata/site check:launch` (the deploy job runs it under plain Node).

**Cause.** `site/src/features/home/home-content.ts` imported `'../../shared/content/agent-prompt'` without `.ts`. Vite and
Vitest add the extension, plain Node does not, so the script died with `ERR_MODULE_NOT_FOUND`; the gate's unit tests import
its functions under Vite and never ran the script.

**Fix.** The import now says `.ts`. Every other script under `site/scripts` was checked for the same fault by walking the
import graph each one reaches (relative imports and `#src/`): this was the only one.

**Tests (watched fail first):** `tests/unit/scripts/node-imports.test.ts`: the import graph of every `scripts/*.ts` resolves
under plain Node, and `node scripts/check-launch.ts` run as a child process exits non-zero with its own refusals (the
repository is private) and no `ERR_MODULE_NOT_FOUND`. No workflow file changed.
