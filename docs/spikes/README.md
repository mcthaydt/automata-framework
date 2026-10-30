# A0 Spike Verdicts

| Spike | Verdict | Blocks A1? | Key consequence |
|---|---|---|---|
| [S1 Koota](./s1-koota.md) | PASS: **Koota** | yes | Keep Koota. Iterate in StableId order through an incremental index (native order doesn't survive a restore). Send a full render resync on the first frame after a restore. `Changed` needs `changeDetection: 'always'` or `set()`; it was not exercised. |
| [S2 Rapier](./s2-rapier.md) | PASS | yes | State and snapshot bytes are identical in all four engines and round-trip exactly, so Rapier's snapshot bytes go straight into `sim.hash()`. The `-compat` builds work under Ruken's CSP. |
| [S3 Three](./s3-three.md) | PASS (historical) | no | Three.js is no longer used (ADR 0002, 2026-10-11). Still relevant: verify a non-black WebGPU capture path on the CI GPU runner. |
| [S4 Pixi](./s4-pixi.md) | PASS | no (M1/M3) | GLSL + WGSL filter pairs. Screen-space effects take pixel position from the vertex stage. |
| [S5 Math](./s5-math.md) | PASS | yes | `dmath` becomes `automata-sim/math`. `Math.*` allowlist: `sqrt fround round floor ceil trunc abs min max sign imul`; the `**` operator is banned, and Biome's `useExponentiationOperator` is off in sim code. Native `Math` differs in every engine. |
| [S8 Effect runtime](./s8-effect.md) | PASS, with budgets | no (sets M1.5's budgets) | Run 2026-10-11 by the ship lane (PR #6, `6056f82`; the report lands with #6). Effect 3.22.2 adds 28.0 kB gzip and 50–73 ms cold boot at 4× CPU throttling. Budgets: E1 Effect ≤35 kB gzip; E2 ≤100 ms added boot at 4×; E3 placeholder ≤60 kB gzip; E4 placeholder boot ≤300 ms at 4× (E3 and E4 are placeholder figures until the runtime exists); E5 zero CSP violations. Mitigations: one runtime per game, no Effect allocation per frame, no Effect Schema or Stream on the boot path, dynamic import for services not needed before ready. Still open: real phones, WebKit throttling, and frame-loop allocation (checked by the runtime lane in M1.5). |
| [S6 Ruken stub](./s6-ruken-stub.md) | USABLE | no (M1) | Ruken answered the gap list on 2026-10-02. The stub is retired in favour of `@ruken/sdk` (ADR 0004); its contract cases move into the `host` adapter's tests in M1.4. |
| [S7 `@pixi/3d`](./s7-pixi3d.md) | PASS with conditions | yes (M3.4) | Run 2026-10-30 on the GPU runner (run 41114454352, `5bf53a87`, Apple M1). `@pixi/3d` 0.1.0-beta.2 runs under Ruken's CSP only with the AF-owned four-function shim (`render-pixi3d/no-eval`, the Owner's call); phone-profile p95 frame interval 16.7 ms (Chromium 4×) and 19 ms (WebKit) against 33.3 ms; non-black captures. **WebGL2/WebGPU parity fails** (61.8% of pixels, max 87, a wall missing under WebGPU), so 3D is WebGL2-only until the beta is fixed. The angled view keeps a figure at 30% of frame height down to 780×270; the authored room and fog must close the void band. Spike code removed; recoverable from git history. |

Final suite run (2026-10-01, M1 Mac): `Test Files 37 passed (37)`, `Tests 123 passed (123)` across Node, Chromium, WebKit and Firefox. `pnpm typecheck` and `pnpm lint` both exit 0.

The spike code was removed when A0 closed. It is recoverable from git history: the commits before `docs(a0): close spikes` on this branch.

## Planned spikes (2026-10-11)

| Spike | Question | Before |
|---|---|---|
| S7 `@pixi/3d` | Does the `@pixi/3d` beta run under Ruken's CSP with WebGL2 parity for the post chain, ≥30 FPS on the S20 and iPhone 13 profiles, and a non-black capture on the CI GPU runner? Which beta APIs does AF depend on? | M3 plan (ADR 0002) |
