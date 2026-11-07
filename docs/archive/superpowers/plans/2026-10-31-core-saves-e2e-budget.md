# core-saves e2e budget: where the time goes

> Follow-up row from the DIST lane (core-saves "another device changes the slot" ran 31.6 s against its 30 s budget
> under 2 workers, 19.9 s alone). Test/tooling only. Status: **option 2 implemented** (coordinator, 2026-10-31: "Decision: option 2. Raise the conflict journey's
> budget to 45 s"); option 1 is the follow-up row CI.E2E2.

## Measurements (cloud container, 4 CPUs, headless Chromium shell, `main` 547ce175)

| Run                                        | conflict journey (`:95`) | S-c (`:69`)     |
| ------------------------------------------ | ------------------------ | --------------- |
| `examples`, 1 worker                       | 19.7 s                   | 11.3 s          |
| `examples` + `examples-compact`, 2 workers | 29.1 s / 25.4 s          | 16.7 s / 12.9 s |

Trace of the conflict journey (1 worker): every input is slow, not a fixed wait. `press('ArrowRight', {delay: 500})`
2.3 s, each `press('Escape')` 1.2–1.3 s, clicks 0.4–1.4 s, `page.evaluate` 0.57 s. The host sync poll (1.9 s) and the
conflict wait (1.3 s) are the only waits the debounce explains.

## Root cause

- On the title and paused screens the frame runs at 60 fps and a key press takes 20–140 ms; on the play screen it
  runs at ~6 fps (longest frame 190–265 ms) and a press takes 1.6–2.2 s. The same holds for `core-basic-window` and
  `core-input-keys`, so it is every rendering example, not saves.
- The JS profile during play is idle (`(program)` 2.29 s of 2 s sampled). A Chromium trace shows the renderer main
  thread in `ProxyMain::BeginMainFrame → Commit → LayerTreeHost::DoUpdateLayers → GLES2::ReadPixels →
CommandBufferHelper::Finish` for 1.73 s of 2 s, while the GPU process runs SwiftShader for 1.85 s and the display
  compositor is `SoftwareRenderer`.
- So: headless Chromium here composites in software, which reads the whole WebGL canvas back (728×1678 on the
  `Pixel 7` project, 1464×540 compact) with a blocking `ReadPixels` every frame. Each Playwright action waits behind
  that frame, and a second worker on 4 CPUs doubles it. The conflict journey has the most actions on the play
  screen, so it is the one past the budget.

## Experiment: `--use-angle=swiftshader` on the examples projects

- Mechanism confirmed: renderer main thread 88 ms per 2 s (was 1767 ms), no `ReadPixels`; a press takes 38–58 ms.
- Conflict journey: 8.3 s alone; 9.1 s / 9.6 s with 2 workers (was 19.7 s; 29.1 s / 25.4 s).
- **Regression:** S-c fails 3/3 on `examples` with 2 workers (passes alone 3/3): after `location.reload()` the new
  document's HTML response ends at 68 ms but `domInteractive` comes at 5.3–7.4 s, so the title is not there within the
  5 s expect. With the readback gone, SwiftShader no longer waits for the page and keeps the 4 CPUs busy rendering,
  which starves the other worker's reload. Not acceptable as is; reverted.

## Options

1. The flag, plus a boot-sized wait after the reload in S-c (the same wait `openHosted` gives the first boot). This
   fixes the cause of the input stall but covers the reload stall with a longer wait.
2. Keep software compositing, and give the conflict journey a 45 s budget, with the trace above as the evidence
   (~1 frame of readback per action × the actions on the play screen). This changes no runner behavior.
3. Render the examples' canvas at device-pixel ratio 1 under test (a quality setting the runner passes). That cuts
   the readback about 3×, but it needs a product-facing option for test behavior.

## Decision and change

- Option 2: `examples/e2e/core-saves.e2e.ts` conflict journey calls `test.setTimeout(45_000)`, with the measured cause
  beside it. No other budget and no runner flag changed. 45 s is 1.5× the worst measured 2-worker run (29.1 s).
- Option 1 goes to the tooling row CI.E2E2, measured across the whole examples suite. Its starting point is the
  experiment above: the flag cut the conflict journey from 19.7 s to 8.3 s alone and to 9.1 s / 9.6 s with 2 workers,
  but S-c then failed 3/3 with 2 workers, with the reload's `domInteractive` at 5.3–7.4 s.

## Execution log

- 2026-10-31: measured and traced as above; the flag experiment was reverted; nothing changed in the product.
- 2026-10-31: option 2 applied. Gates in the Verification section.

## Verification

- Selected: `pnpm exec playwright test examples/e2e/core-saves.e2e.ts --project=examples --project=examples-compact
--workers=2`: 6 passed. `pnpm format`; `TURBO_FORCE=true pnpm check`: 35/35 tasks green.
- Omitted: `pnpm build`, api-report, api-index, agent-skills, changesets (no package source, exports or doc comments
  changed); parity (no sim, renderer, ui or golden touched); the whole e2e suite (focused spec only, per the lane
  rules).
- Pending: the `af-linux` nightly e2e run.

## Superseded (CI.E2E2)

CI.E2E2 removed the cause: the examples journeys emulate a device-pixel ratio of 1, so a third of the canvas is read
back per frame. The conflict journey ran 15.4 s with 2 workers across the whole suite, and the 45 s budget went back
to the default 30 s ([CI hardening plan](2026-10-31-ci-hardening.md)).
