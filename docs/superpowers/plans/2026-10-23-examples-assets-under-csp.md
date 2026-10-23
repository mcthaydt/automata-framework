# EX follow-up: small example assets load under Ruken's CSP TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §5 (the runner serves every example under Ruken's headers) and §7 (every example boots under the fake host with no console error or CSP violation); AGENTS.md "Honor host authority" (Ruken's CSP has no `eval` and its `connect-src` is `'self'`).
- **Task:** `Follow-up (found 2026-10-23) — Small example assets are inlined as data: URLs, which Ruken's CSP blocks` (02). Lane examples.
- **Status:** drafted 2026-10-23; implementation follows the first failing tests.
- **Progress:** 0 of 4 steps.

## What is wrong

`examples/textures/textures-sprite.ts` draws nothing under the fake host: after Play the screen is black except the Pause button. The example loads its sheet with `new URL('../resources/sprites/wick-run.png', import.meta.url).href`. The sheet is 278 bytes, and Vite's production build inlines any asset under `assetsInlineLimit` (4 kB) as a `data:image/png;base64,...` URL. Pixi's loader reads that URL with `fetch`, and Ruken's CSP (`connect-src 'self'`, served by the runner exactly as Ruken serves it) refuses it: `Refused to connect to 'data:image/png;base64,...'`, then `[Loader.load] Failed to load`. Measured with Chromium through the fake host at Pixel 7: ready at 477 ms, Play clicked at 837 ms, the two errors at 1059 ms.

The smoke test that should catch this stops at `data-state=ready`, which is before Play starts the room, so it passes. Every other example, played the same way at Pixel 7 and 780 × 270, logs no error (14 examples measured).

The same trap waits for any game whose small asset goes through `new URL(..., import.meta.url)`; that is the game-side follow-up below, not this PR.

## Decisions

- **Emit every asset as a file.** The examples runner's Vite config sets `build.assetsInlineLimit: 0`. A same-origin file is what Ruken's CSP allows, and one rule for every example beats a size threshold that a future asset can cross. A test on the resolved config pins it.
- **Smoke plays the example.** After ready, `smokeExamples` clicks Play when the title shows, waits for `play-screen`, lets the game run 30 animation frames (a wait on frames, not on milliseconds) and then asserts no console error or CSP violation. The two assertions are different failures: the config test says why, the smoke test says what the player sees.
- **Not in this PR.** Games (`create-game`, Emberwick's Vite config, the content Vite plugin) get the same default only with their owners; a follow-up row records it.

## Files

- **Modify:** `tooling/examples-runner/src/vite-plugin.ts` (+ `vite-plugin.test.ts`), `tooling/examples-runner/src/smoke.ts`; this plan; `docs/02-master-delivery-plan.md` (the follow-up rows).
- No golden changes (the sim is untouched), no changeset (`@mcthaydt/examples-runner` is private).

## Interfaces

- **Consumed:** `readCatalog`, `openHosted`, `collectErrors`, the examples' `play` and `play-screen` test ids (the default screens).
- **Produced:** nothing public.

## Steps

- [ ] **1. Red, the config.** In `vite-plugin.test.ts`, resolve the runner's build config and expect `build.assetsInlineLimit` to be `0`. Run `pnpm --filter @mcthaydt/examples-runner test:unit`; it fails on `undefined`.
- [ ] **2. Red, the smoke.** Change `smoke.ts` so each example plays and runs 30 frames before the error check. Run the `textures-sprite` smoke against this checkout's build with a temporary Playwright config; it fails with the CSP error (the first-attempt output is kept in the log below).
- [ ] **3. Fix.** Set `assetsInlineLimit: 0` in the plugin's `config()`. Rebuild; step 1's test passes and the `textures-sprite` screenshot shows the sprite; the smoke passes for all 14 examples at both sizes.
- [ ] **4. Gates and docs.** `pnpm format`, `pnpm check`, `pnpm build:examples`; 02's follow-up rows (this one and the game-side one).

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; the smoke run for every example at Pixel 7 and 780 × 270 in local Chromium; a screenshot of `textures-sprite` before and after.
- Omitted here, pending on CI: the `examples` and `examples-compact` Playwright projects on the shared runner, and parity.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
