# A0 Spike Verdicts

| Spike | Verdict | Blocks A1? | Key consequence |
|---|---|---|---|
| [S1 Koota](./s1-koota.md) | PASS: **Koota** | yes | Keep Koota. Iterate in StableId order through an incremental index (native order doesn't survive a restore). Send a full render resync on the first frame after a restore. |
| [S2 Rapier](./s2-rapier.md) | PASS | yes | State and snapshot bytes are identical in all four engines and round-trip exactly, so Rapier's snapshot bytes go straight into `sim.hash()`. The `-compat` builds work under Ruken's CSP. |
| [S3 Three](./s3-three.md) | PASS | no (A2/A4) | One TSL post stack serves both backends with pixel-identical output. Verify a non-black WebGPU capture path on the A3 runner. |
| [S4 Pixi](./s4-pixi.md) | PASS | no (A2/A4) | GLSL + WGSL filter pairs. Screen-space effects take pixel position from the vertex stage. |
| [S5 Math](./s5-math.md) | PASS | yes | `dmath` becomes `automata-sim/math`. `Math.*` allowlist: `sqrt fround round floor ceil trunc abs min max sign imul`. Native `Math` differs in every engine. |
| [S6 Ruken stub](./s6-ruken-stub.md) | USABLE | no (A2) | The stub and its contract tests are A2's Ruken-adapter target. The P01 gap list (9 questions) goes to Ruken before F1 (2026-10-16). |

Final suite run (2026-10-01, M1 Mac): `Test Files 37 passed (37)`, `Tests 123 passed (123)` across Node, Chromium, WebKit and Firefox. `pnpm typecheck` and `pnpm lint` both exit 0.

The spike code was removed when A0 closed. It is recoverable from git history: the commits before `docs(a0): close spikes` on this branch.
