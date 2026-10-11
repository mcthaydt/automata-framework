# A0 Spike Verdicts

| Spike | Verdict | Blocks A1? | Key consequence |
|---|---|---|---|
| [S1 Koota](./s1-koota.md) | PASS: **Koota** | yes | Keep Koota. Iterate in StableId order through an incremental index (native order doesn't survive a restore). Send a full render resync on the first frame after a restore. `Changed` needs `changeDetection: 'always'` or `set()`; it was not exercised. |
| [S2 Rapier](./s2-rapier.md) | PASS | yes | State and snapshot bytes are identical in all four engines and round-trip exactly, so Rapier's snapshot bytes go straight into `sim.hash()`. The `-compat` builds work under Ruken's CSP. |
| [S3 Three](./s3-three.md) | PASS (historical) | no | Three.js is no longer used (ADR 0002, 2026-10-11). Still relevant: verify a non-black WebGPU capture path on the CI GPU runner. |
| [S4 Pixi](./s4-pixi.md) | PASS | no (M1/M3) | GLSL + WGSL filter pairs. Screen-space effects take pixel position from the vertex stage. |
| [S5 Math](./s5-math.md) | PASS | yes | `dmath` becomes `automata-sim/math`. `Math.*` allowlist: `sqrt fround round floor ceil trunc abs min max sign imul`; the `**` operator is banned, and Biome's `useExponentiationOperator` is off in sim code. Native `Math` differs in every engine. |
| [S6 Ruken stub](./s6-ruken-stub.md) | USABLE | no (M1) | Ruken answered the gap list on 2026-10-02. The stub is retired in favour of `@ruken/sdk` (ADR 0004); its contract cases move into the `host` adapter's tests in M1.4. |

Final suite run (2026-10-01, M1 Mac): `Test Files 37 passed (37)`, `Tests 123 passed (123)` across Node, Chromium, WebKit and Firefox. `pnpm typecheck` and `pnpm lint` both exit 0.

The spike code was removed when A0 closed. It is recoverable from git history: the commits before `docs(a0): close spikes` on this branch.

## Planned spikes (2026-10-11)

| Spike | Question | Before |
|---|---|---|
| S7 `@pixi/3d` | Does the `@pixi/3d` beta run under Ruken's CSP with WebGL2 parity for the post chain, ≥30 FPS on the S20 and iPhone 13 profiles, and a non-black capture on the CI GPU runner? Which beta APIs does AF depend on? | M3 plan (ADR 0002) |
| S8 Effect runtime | What do Effect's bundle size and cold boot cost on the phone profiles under Ruken's CSP, and does the frame loop stay allocation-free? | M1.1, on the ship lane's placeholder page; sets budgets and mitigations, it does not decide whether Effect is used (ADR 0003) |
