# S2: Rapier deterministic builds

- **Question:** Do `@dimforge/rapier{2d,3d}-deterministic-compat@0.21.0`:
  - give bit-identical state **and snapshot bytes** in all four engines;
  - survive a mid-run restore;
  - round-trip snapshots byte-for-byte;
  - load under `script-src 'self' 'wasm-unsafe-eval'`?
- **Method:** `spikes/s2-rapier/*`.
  - Each scene: 40 balls + 20 cuboids + a 6-link revolute-joint chain on a ground slab, 300 steps.
  - The state hash covers translation, rotation, linear velocity and angular velocity of all 67 bodies.
  - One run restores from its own snapshot at step 150.
- **Run:** 2026-10-01, M1 Mac. `Tests 8 passed (8)` across Node, Chromium, WebKit and Firefox.

## Results
| Check | Node | Chromium | WebKit | Firefox |
|---|---|---|---|---|
| 3D state hash (pos/rot/linvel/angvel) | PASS | PASS | PASS | PASS |
| 3D snapshot bytes hash | PASS | PASS | PASS | PASS |
| 2D state hash | PASS | PASS | PASS | PASS |
| 2D snapshot bytes hash | PASS | PASS | PASS | PASS |
| Restore at 150 → identical state and bytes | PASS | PASS | PASS | PASS |
| `restore(s).takeSnapshot() == s` | PASS | PASS | PASS | PASS |
| CSP load + step (`ok`, no violations) | n/a | PASS | PASS | PASS |

- **Hashes:**
  - 3D: state `83e90867…`, snapshot `48d208d8…` (104,876 bytes).
  - 2D: state `0ff8e1a2…`, snapshot `52989e0d…` (86,524 bytes).
- **Built payload** (Vite build of the CSP page, 2D + 3D compat with the wasm base64-inlined): 7,814,533 bytes raw, 2,959,014 bytes gzip -9. A game ships only one dimension; per package that is about 1.66 MB (3D) or 1.30 MB (2D) gzipped.

## Verdict
**PASS.** Physics is bit-identical across V8, JSC and SpiderMonkey, including joints and mixed shapes. Mid-run restore is exact, and the snapshot bytes themselves are canonical: they are the same in every engine and survive a round trip.

## Consequences for Plan 2
- **`sim.hash()` may include Rapier snapshot bytes directly: yes.** The snapshot's physics section is `world.takeSnapshot()` verbatim.
- **Package:** the `-compat` builds are proven under Ruken's CSP. Follow-up for A3: measure the non-compat build (separate `.wasm`, streaming compile) to cut the base64 overhead, which is about a third of the payload.
