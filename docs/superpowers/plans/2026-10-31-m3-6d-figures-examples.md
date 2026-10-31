# M3.6d part 2: figures examples, poses, clips and aim (TDD plan)

- **Task:** "M3.6d part 2" in `docs/02-master-delivery-plan.md` (size M). Spec: [M3 spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.4.2 to §4.4.6 and the one-file examples list (module `figures`: `figures-poses.ts`, `figures-clips.ts`, `figures-aim.ts`, each 100 code lines or fewer); the [M3.6d plan](2026-10-30-m3-6d-evaluate.md) decision 1 (the examples moved here).
- **Prerequisites (merged):** M3.6d `evaluate()` (#276), the figure view (#270, #274) and the view on `evaluate()` (#282).
- **Lane:** 3D (`session_01QYLU1e5XhLPpzpvZHs9vzx`, then `session_01QYLU1i7StfVkFMEukSn2Wd` from 2026-10-31 01:16Z). Branch `claude/3d-m3-6d-examples` from `origin/main` `1045a826`; worktree `/home/user/wt/m3-6d-examples`.
- **Core only:** `Tier: core` (figures and render3d are free, M3R-D20); figures stays private (D-1), so no changeset.

## Pattern (follow `examples/figures/figures-walk.ts` and `figures-outfits-items.ts`)
- Content inline, **written as compiled** (typed `FigureDef`, `FigureLibrary`, `Gait`, poses and clips as the compiler emits them: degrees in `rot`/`fk`/`yaw`, metres in `pos`). Parsing with the schemas outside the compiler leaves content-ref markers `build` cannot read (M3.5d part 2 log).
- Wick, the swatches and the `bounce` gait copied from `figures-walk.ts` (FigureBuilder `a1f7246`). The budget is `CODE_LINE_BUDGET = 100` (`tooling/examples-runner/src/catalog.ts`: header, blank and comment-only lines do not count); `figures-walk` is 92, `figures-outfits-items` 100. Keep the boilerplate grouped as `figures-outfits-items.ts` does (one line per group) to fit.
- Presentation time for clips: the view's `now` (`FigureViewOptions.now`) from the sim tick, as base-3d's `main.ts` does (`simTick / 60` set in the scene hook's `apply`), so a clip's `startedAt` (seconds) matches the sim's start tick. Shapes: `FigureState.action { id, startedAt }`, `stances [{ id, startedAt, endedAt? }]`, `aim [{ at: [x, y, z], part: 'head' | 'chest' | 'handL' | 'handR', weight? }]` in the figure's space (`packages/figures/src/evaluate/figure-state.ts`, `solve/targets.ts`).
- Poses and clips from the figures fixtures (`packages/figures/src/testing/fixtures/content/figure-poses/*.toml`, `figure-clips/*.toml`), compiled form as in `games/base-3d/src/content/generated/content.json` (e.g. `point`: `{ effectors: { handR: { pos: [-0.16, 1.3, 0.52], rot: [-90, 0, 0] }, head: { rot: [0, -10, 0] } }, root: { yaw: 15 } }`; a clip: `{ length, loop: 'once' | 'hold', mask: [...], keys: [{ t, pose, ease? }], markers? }`). Record the fixture files used.

## The three examples (files under `examples/figures/`)
1. **`figures-poses.ts`**: the pose library. A fixed camera 3 m in front (as `figures-outfits-items`). The sim cycles a `pose` index every 2 s (component `{ x, y, z, yaw, pose: u32, since: u32 }`); the view plays a hold clip per pose (`free` → the pose over 0.4 s, `loop: 'hold'`, the full-body mask), built in one line from the pose ids: `stand`, `guard-high`, `point`, `reach-out`, `hands-on-hips`, `kneel`. Shows: poses are data; a clip blends the figure into one with the 80 ms action transition.
2. **`figures-clips.ts`**: clips over the walk. Wick walks `figures-walk`'s square under the follow camera; every 1.5 s the sim starts the next of `reach` (mask `armR`, `torso`), `look` (`torso`, `head`, hold), `flinch` (most of the body) as the action, recorded as `{ clip: u32, startedAt: u32 }`. Shows: masks (the legs keep walking under a reach), `once` vs `hold`, the action transition.
3. **`figures-aim.ts`**: aim. Wick stands; a small orb (an `occluders.box`, or a mesh) circles him at head height; `aim: [{ part: 'head', at }, { part: 'chest', at, weight: 0.5 }, { part: 'handR', at }]` with `at` in the figure's space (the orb's position minus Wick's, rotated by −yaw). The orb is drawn by a second entity view or the scene hook reading the same sim row. Shows: aim is solved every frame, head and chest limits (`DEFAULT_RIG_LIMITS`) clamp it behind him.

## Steps (strict TDD; tick each as its check passes)
- [x] 1. Failing e2e specs first: `examples/e2e/figures-poses.e2e.ts`, `figures-clips.e2e.ts`, `figures-aim.e2e.ts`, modelled on `examples/e2e/figures-walk.e2e.ts` (the cloak-blue pixel count over 200, and the pixels' hash changes between frames as the pose, clip or aim changes; zero console errors and CSP violations under the fake host). Add the three to the `examples-webkit` project's `testMatch` (it already matches `figures-*.e2e.ts`: check). Run `pnpm exec playwright test examples/e2e/figures-poses.e2e.ts --project=examples` → fails (404: no example).
- [x] 2. `figures-poses.ts`; its spec passes in `examples`, `examples-compact` and `examples-webkit`. `pnpm --filter @mcthaydt/examples-runner test` (catalog: header, module `figures`, budget).
- [ ] 3. `figures-clips.ts`; same checks.
- [ ] 4. `figures-aim.ts`; same checks.
- [ ] 5. Review images under `docs/evidence/owner-visual/2026-10-31-m3-6d-figures-examples/` (each example at 844×390 and 780×270 in Chromium, two moments each), README explaining each, the capture script inline (see `docs/evidence/owner-visual/2026-10-30-m3-7b-flow/README.md` for the pattern). If the examples index uses approved screenshots (`screenshots-approved.json`), leave approval to the coordinator.
- [ ] 6. Gates; PR.

## Gates
`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build:examples`; the three focused e2e specs in `examples`, `examples-compact` and `examples-webkit` (never the whole suite); `pnpm changeset status --since=origin/main` and `check-changesets` (no changeset). Omitted unless touched: `pnpm build`, api-report, api-index, agent-skills (no package export changes); parity (no sim or renderer package change).

## Owner gates
Visual acceptance recorded by the coordinator from the committed images. No device test.

## Execution log
- 2026-10-31: plan written from `origin/main` `1045a826`.
- 2026-10-31 (lane `session_01QYLU1i7StfVkFMEukSn2Wd`): step 1, the three specs written; `figures-poses.e2e.ts` failed in `examples` before the example existed (the demo frame never reached `data-state="ready"`: no page). The poses spec checks the hood's top row moves by over 15 px (kneeling, the second pose) rather than a pixel hash, since idle breathing alone moves pixels; the aim spec also checks the orb's red pixels (over 10) and that they move.
- Step 2: `figures-poses.ts` at 100 code lines; to fit the budget it shows five poses (`stand`, `kneel`, `guard-high`, `point`, `reach-out`; `hands-on-hips` dropped), the fixture poses trimmed to their main handles (`stand` without its head turn, `guard-high` without its chest tilt and clavicle turns, `reach-out` without its elbow pole). The view's `now` is the sim's tick in seconds, set by the scene hook's `apply` (`result.tick / 60`). Spec passes in `examples`, `examples-compact`, `examples-webkit` (3 passed, 1.1 min); `examples-runner` catalog tests 26 passed; `examples` typecheck clean.
