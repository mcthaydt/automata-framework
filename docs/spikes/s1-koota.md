# S1: Koota determinism, snapshot, change tracking

- **Question:** Is Koota 0.6.6 deterministic across engines with structural churn, and can a world be snapshotted to bytes and restored so the continuation is identical?
- **Method:** `spikes/s1-koota/*`.
  - The tick is order-dependent. It folds stable IDs in iteration order, picks victims and relations by index, and spawns during the step.
  - Snapshots go through encode → decode → restore.
  - Miniplex 2.0.0 runs the same tick as a comparison.
- **Run:** 2026-10-01, M1 Mac. Node 24.8, Chromium, WebKit and Firefox via Playwright 1.63. Vitest 5.0.3 with a cold Vite cache: `Tests 32 passed (32)`.

## Results
| Check | Node | Chromium | WebKit | Firefox |
|---|---|---|---|---|
| Native order + churn hash (10k live) | PASS | PASS | PASS | PASS |
| Sorted: bytes → restore → continue == straight | PASS | PASS | PASS | PASS |
| Added/Removed tracking hash (see the `Changed` correction below) | PASS | PASS | PASS | PASS |
| Miniplex sorted restore + hash | PASS | PASS | PASS | PASS |

All four engines produced the same committed hashes:
- churn `317b7e9e…`
- snapshot `4ea4aba3…`
- changes `22c26438…`
- miniplex `819681cc…`

Answers to the questions, identical in all four engines:
- **(a) Is native order deterministic across engines?** Yes. Even with in-tick churn, 10,060 live entities produce the same hash everywhere.
- **(b) Is native order ascending by stable ID?** **No.**
- **(c) Does native order survive a restore?** **No.** A world rebuilt in StableId order iterates differently from the original. Consequence: wherever order affects the result, the facade must iterate in StableId order. Native order is deterministic within one uninterrupted run, but replay and save/load break it.
- **(d) Are IDs recycled?** Yes: 60 live entities reused destroyed Koota IDs. Consequence: the facade owns `StableId`, and Koota IDs never leave the sim (already in spec §4.4).
- **(e) Can relations with data be snapshotted?** Yes, by reading `targetsFor` plus `get(Contains(t))`, sorting by target StableId, and encoding as `(u32 sid, i32 amount)` pairs. Restore spawns every entity first, then adds the relations.
- **(f) `Changed` never fired in this spike (corrected after the final review).** The tick writes with a default `updateEach`, which does **not** emit `Changed`. A follow-up probe against koota 0.6.6 gave:

  | How Position was written (10 entities) | `Changed(Position)` count |
  |---|---|
  | `updateEach`, default options | 0 |
  | `updateEach(…, { changeDetection: 'always' })` | 10 |
  | `entity.set` on one entity | 1 |

  So the committed tracking hash proves **Added and Removed** are deterministic; it says nothing about `Changed`. Consequence: the facade's field setters must write through `changeDetection: 'always'` or `entity.set`, and A1's render-delta golden must assert a non-empty `changed` list after a field write.
- **(f2) Change tracking after a restore:** the first tick differs (everything looks added); later ticks are equal. Consequence: after a restore, the render delta must be a **full resync**. Incremental deltas resume on the next tick.
- **(g) ms/tick, ~2k growing to ~2.6k entities:**

  | | Native | Sorted |
  |---|---|---|
  | 1× | 0.163 ms | 0.622 ms |
  | 4× CPU throttle | 0.66 ms | 2.68 ms |

  Consequence: sorting every tick costs about 4×. Keep an **incremental StableId-ordered index** that is updated on spawn and despawn; don't sort per tick. Even naive sorting fits the ~8 ms sim budget at this scale.
- **(h) Miniplex:** same conclusions. It is deterministic and restorable in sorted order, and its native order also does not survive a restore. Switching ECS would not remove the need for StableId ordering.

## Verdict
**KOOTA.** It passes every determinism, byte snapshot/restore and change-tracking check in all four engines. It does so faster than the budget at 4× throttle, and it adds relations and change detection that Miniplex lacks. The StableId ordering rule applies to either library, so it is not a reason to switch.

## Consequences for Plan 2 (A1)
- **Facade ordering rule:** every order-sensitive iteration (systems, render delta, snapshot) goes through a StableId-ordered index maintained incrementally. Native Koota order is never observable to game code.
- **Snapshot entity and relation sections:** use the encoding from `snapshot.ts`.
  - Rows are sorted by StableId and carry a presence-flag byte, then the f32 fields (little-endian).
  - Relations are stored as sorted `(sid, amount)` lists.
  - Restore spawns in StableId order, then adds relations.
- **Render-delta rule after restore:** the first `StepResult.render` after `restore()` is a full resync (all rows as `added`), not a Koota-tracked delta.
