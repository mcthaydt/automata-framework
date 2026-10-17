# S8: Effect runtime cost on phones (2026-10-11)

- **Question:** What do Effect's bundle size and cold boot cost on the phone profiles under Ruken's CSP? This sets budgets and mitigations; it does not decide whether Effect is used ([ADR 0003](../adr/0003-effect-outside-the-sim.md)).
- **Verdict:** PASS, with the budgets below. Effect 3.22.2 adds **28.0 kB gzip** to the placeholder and about **50–70 ms** to its cold boot at 4× CPU throttling. It runs under Ruken's CSP with no violations: the bundle has no global `eval` or `new Function` (its `eval(...)` hits are methods on its own op objects).

## Method

- **Subject:** `examples/placeholder` (now `games/placeholder`, EX.2), built twice by [`games/placeholder/s8/measure.ts`](../../games/placeholder/s8/measure.ts) (`pnpm --filter @af-examples/placeholder measure:s8`):
  - **with Effect:** the shipped page (`main.ts` → `boot`: `Effect.gen`, `Effect.tryPromise`, `Data.TaggedError`, `Effect.runPromise` around `Ruken.init`);
  - **without Effect:** `s8/no-effect.ts`, the same handshake and line of text on plain promises.
  - Both include `@ruken/sdk`, so the difference is Effect alone.
- **Bytes:** every `.js`, `.css` and `.html` file of each Vite 8.3.2 production build, raw and gzip level 9.
- **Cold boot:** Chromium (Playwright 1.63.0, headless shell build 1243). Each run gets a fresh context (empty cache), the device descriptor, and `Emulation.setCPUThrottlingRate` 4. The time is `performance.now()` when the page sets `data-state="ready"`: navigation start to the line of text after the SDK's handshake (standalone, because the page is top-level). Five runs per cell; the median is reported with every run in brackets.
- **Headers:** each page is served with `compileHeaders` from `@ruken/manifest` on the placeholder's own manifest: Ruken's CSP (`script-src 'self' 'wasm-unsafe-eval'`, no `unsafe-eval`) plus its other headers. A `securitypolicyviolation` event fails the run.
- **Profiles:** `iPhone 13` and `Galaxy S9+`. Playwright 1.63 has no Galaxy S20 descriptor, so the S9+ (the nearest Android phone it has) stands in. The CPU throttle stands in for the phone's slower CPU on both.
- **Machine:** cloud container, 4 vCPU Intel Xeon 2.10 GHz, Linux, Node 24.21.0. Run to run, the medians moved by about 15 ms.

## Results

Three runs of the script, back to back:

| Build | Raw | Gzip | Galaxy S9+, 4× CPU | iPhone 13, 4× CPU |
|---|---|---|---|---|
| with Effect (shipped) | 143.28 kB | 46.67 kB | 147 ms (156, 140, 147, 138, 199) | 150 ms (165, 141, 150, 139, 179) |
| without Effect | 54.38 kB | 18.66 kB | 80 ms (77, 80, 85, 81, 77) | 82 ms (90, 82, 75, 112, 74) |
| with Effect (shipped) | 143.28 kB | 46.67 kB | 165 ms (239, 165, 168, 159, 153) | 168 ms (225, 168, 187, 155, 158) |
| without Effect | 54.38 kB | 18.66 kB | 99 ms (117, 99, 99, 94, 99) | 95 ms (123, 90, 127, 89, 95) |
| with Effect (shipped) | 143.28 kB | 46.67 kB | 179 ms (197, 183, 179, 170, 175) | 161 ms (165, 166, 156, 161, 160) |
| without Effect | 54.38 kB | 18.66 kB | 109 ms (120, 100, 108, 147, 109) | 111 ms (118, 104, 111, 105, 113) |

- **Effect's share:** 88.9 kB raw, **28.0 kB gzip**. That is the floor for any Effect use: `Effect.gen` and `runPromise` bring in the fiber runtime, whatever else a game imports. Over a slow 1.6 Mbps link it is about 140 ms of extra transfer on the first launch; Ruken serves build files as immutable, so later launches read them from cache.
- **Boot cost:** Effect added 67, 66 and 70 ms (S9+) and 68, 73 and 50 ms (iPhone 13) to the median: parsing and evaluating the extra 89 kB, plus building the runtime once.

## Budgets

The budgets are enforced by `games/placeholder/s8/budgets.ts` (tested): `pnpm --filter @af-examples/placeholder budget:size` (E1, E3) runs in CI's checks job and `pnpm ci:local`, and `budget:boot` (E2, E4, E5) runs in the nightly browser job. Boot numbers are only comparable between runs on one machine class; the budgets leave about 2× headroom over this container.

| ID | Budget | Measured |
|---|---|---|
| E1 | Effect's share of a game's initial bundle ≤ **35 kB gzip** | 28.0 kB |
| E2 | Effect adds ≤ **100 ms** to cold boot at 4× CPU (median, both profiles) | 50–73 ms |
| E3 | The placeholder's whole page ≤ **60 kB gzip** | 46.67 kB |
| E4 | The placeholder boots to `ready` in ≤ **300 ms** at 4× CPU (median, both profiles) | 147–179 ms |
| E5 | No CSP violation under `compileHeaders` | none |

E3 and E4 cover the placeholder only. `base-2d` (M1.8) re-runs this script with its own entry and sets the budget for a real AF game, Pixi included.

## Mitigations

- **One runtime per game.** Build the Effect runtime once at boot and reuse it. Never run `Effect.runPromise` per frame: the frame loop stays plain code, and no Effect is allocated per frame (ADR 0003).
- **Keep heavy modules out of the boot path.** Zod is the schema language, so no `effect/Schema`. `Stream`, `@effect/platform` and similar stay out of game bundles unless a feature needs them, and then load with a dynamic `import()` after `ready`.
- **Named imports from `effect` only,** so Vite tree-shakes. This was checked: the no-Effect build carries none of it.
- **If E1 or E2 trips:** move the services that are not needed before `ready` behind dynamic imports first. Only then look at the boot path's own Effect use.
- **Re-measure** whenever the Effect version changes (`docs/versions.md`), and in M1.8 on `base-2d`.

## Not covered (open)

- **Real phones.** These numbers come from emulation on a server CPU. Real-device numbers need the GPU runner (D-5) or the Owner's phones.
- **WebKit.** Playwright's WebKit has no CPU throttling, so the iPhone 13 profile ran in Chromium with the iPhone's viewport, pixel ratio and user agent.
- **The frame loop (measured M1.5 Task 20, commit `278af83`):**
  - **Machine:** Apple M-series Mac (Darwin arm64, Node v24.8.0, Chromium via Playwright 1.63.0).
  - **Measurements (`frame-loop.bench.test.ts`, 10 000 frames after 1 000 warm-up, no-op sim double and nullRenderer on `manualFrames`):**
    - **Node 24:** **0.117 µs/frame** median
    - **Chromium:** **0.100 µs/frame** median
  - **Budget:** 2× measured median = **0.30 µs/frame** (0.0003 ms/frame). Frame loop overhead consumes < 0.002% of a 16.67 ms frame budget at 60 Hz.
  - **Purity:** `packages/runtime/src/loop/frame-loop-purity.test.ts` pins that `frame-loop.ts` and the per-frame execution path import nothing from `effect`.
  - **E1 runtime demo measurement:** On `examples/runtime/boot-and-flow` (the blank game on Ruken with runtime flow and DOM screens), Rollup module code contains 158 Effect modules (404.60 kB raw, 86.25 kB gzip).
- **Inside a Ruken frame.** The page booted standalone, which skips the `hello`/`welcome` round trip. The handshake itself is covered by `games/placeholder/src/boot.test.ts` under the fake host.
