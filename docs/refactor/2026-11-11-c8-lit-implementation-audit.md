# c8-lit implementation audit

The audit of cycle c8-lit as built, against [its spec](2026-11-11-c8-lit-spec.md), [its plan](2026-11-11-c8-lit-plan.md),
[the plan audit](2026-11-11-c8-lit-plan-audit.md) and the code. 2026-11-11, no subagents. It changes no code: each finding has
its evidence and a suggested fix.

Audited: FigureBuilder (FB) PR #28, `claude/c8-lit-fb` at `7797d4a` (9 commits on `main` `d6e3c9f`); AF PR #607, `claude/c8-lit` at
`eae6bb4d` (with #602, `claude/fix-scene-depth-hazard`, merged in); EnvironmentBuilder (EB) `main`, read-only. AF's submodule was
initialised from a local FB clone (`submodule.vendor/FigureBuilder.url` in untracked `.git/config`), checked out at the pin `7797d4a`.

**Result: 2 blocking, 7 should-fix, 6 nice-to-have.** B1 is the coordinator's own finding, with the fix checked against the interior.

## What ran

| What | Result |
|---|---|
| FB `npm run typecheck` | exit 0 |
| FB `npm test --maxWorkers=2` | 47 files, **561 of 561** pass |
| FB `npm run view-check` | exit 0: every case under WebGL and **105 under WebGPU**; `wall`, `overlap`, `gameplay/wall/0`, `range/wall`, `stage/sprite-lit` identical to `compose` under both renderers (SwiftShader) |
| AF `pnpm check` (whole) | exit 0, 61 of 61 tasks; the kit's unit suite 25 files, 203 tests |
| The kit's `browser` project, Chromium | 52 passed, 2 skipped (`gate-lit` and `gate-sheets`, gate scripts that run only by hand) |
| The same, WebKit (after `playwright install-deps webkit` and `playwright install webkit`) | 52 passed, 2 skipped (the same two) |
| The kit's `webgpu` project, `AF_WEBGPU=software` | 3 passed (wall, overlap, lit: 0 px from `compose`), 1 skipped (`gate-lit`) |
| The three `characterkit-*` journeys (`examples/3d`, `examples-3d` and `examples-3d-webkit`) | **6 of 6** pass |
| The bench, `AF_BENCH=1`, once | exit 1 (see B2): medians steady 1.56, switch 0.25, flicker 1.74 ms; worst 42.93, 11.60, 43.62 ms |
| A scratch probe of `roomLight` over the base interior (`lampLit`) and exterior (`day`), a 12 x 12 m grid at 0.25 m, 2,401 points each (deleted) | see B1 |
| CI on #607 at `eae6bb4d`, the `checks` job | **green on `af-mac-2`** (label `af-mac`, machine `Dawsons-Mac-V2`, darwin, Node 24.21.0 from `_tool/node/24.21.0/arm64`): `showcase-cells.test.ts` 17 tests, `ulp.test.ts`, `runway-golden.test.ts` pass |

Not run: Firefox (not installed here; the browser project lists it and fails to launch without it); the GPU runner; FB's view-check in
WebKit (it is Chromium only); `pnpm build`, `api-report`, `api-index` (the kit is private, and nothing published changed exports).

## Verified, no finding

- **FB goldens moved only in the named F1 commit.** `d5ca055` ("c8-lit F1: hair and ear pole normals are arch-stable; re-record …") is
  the only commit that touches `tests/golden/` besides `5e4ba04`, which creates `sprite.json`. The three later performance commits touch
  `sprite.ts` alone, and the goldens pass at the head, so they kept the bytes. `identity.test.ts`'s md5 moves in `d5ca055`, named.
- **`sprite.json` is sound**: 64 frames (the base pair, 8 directions standing at D2, under none, a warm lamp from the left, a dim grey
  room, and noon), read by `tests/golden/sprite.test.ts`. `d5ca055` moves 22 of them (19 base-f, 3 base-m), as its body says.
  See S5 for what the record omits.
- **The runway golden and `ARCH_OVERRIDES`.** `ARCH_OVERRIDES` and `expectedFitMd5`'s arch are gone. `runway-golden.test.ts`
  checks the golden's shape, and `cell-miss.ts` stays. The Macs have now run: green on arm64 (table above). Plan Task A2 Step 6
  can be ticked with that evidence.
- **`lightSprite` follows FB's rules.** Each texel moves `clamp(s + shift + form, 1, 7)` on its own row `r` (`RAMPS[rows[k]][to]`). It
  never hops rows and never lands on step 0. Ink, `RAMP_OUTLINE` and step-0 texels hold. The one way off a row is `grade`'s tint toward
  a coloured flat light. A fabric's ground is stepped untinted, and the tile is laid after with `tiled` (the layer rule). The settle
  pass reads a copy, so order does not matter. Under a grey light every texel stays on its row (`sprite.test.ts`).
- **The cache key covers the light exactly.** `RoomLight.lighting` is rebuilt from the quantised values only: whole steps, colour in
  sixteenths, each lamp's direction in eighths and strength in tenths, exposure 0. The key prints exactly those. The lit cell's
  key is `<painted cell key>|<light key>`. What the key does not hash is in N4.
- **WebGPU depth (F4).** The depths go up as the float's own bytes in an `rgba8unorm` texture and are decoded with `bitcast<f32>`. The
  UV is snapped to the texel's centre, because the batch sampler is linear. The colour source is `rgba8unorm`, because Pixi's
  `bgra8unorm` default swapped red and blue. `template.test.ts` undoes the edits against the installed `@pixi/3d` and requires the
  original. Both renderers are tested: FB's view-check and AF's `webgpu` project, each 0 px. Contract section 4b is updated: per-texel
  depth under WebGL and WebGPU, the template, the byte packing, and the colour format.
- **AF's own stage calls `CellSprite.gpu()`.** `painted-stage.ts` calls `entry.quad.gpu(rendererType === WEBGPU)` before
  `show`/`showDepths`, every frame (idempotent). `NOT_WEBGL` and the warning are gone.
- **Boundaries.** Against `claude/fix-scene-depth-hazard` (#602), the branch changes nothing under `packages/`. The files under
  `packages/3d/src/features/look/` and `extensions/world-kit/` that differ from `main` (`duel-snap-filter.ts`, `look-pass.ts`,
  `present-pass.ts`, `sky/passes.test.ts`) are #602's, byte for byte. Nothing touches the clinic spike or world-kit's builder.
- **Parity, as recorded**: `measurements.json` holds WebGL 0 of 230,400 pixels and WebGPU 0 of 230,400 (2 lit cells each), and the gate
  README and progress say the same.
- **The kit is private** (`"private": true`), so no changeset is due. The two in the diff are #602's.

## Blocking

**B1. By day the flat light lifts a figure two steps over its painted cell, and the woman's dark skin reads pale (the coordinator's
finding at `eae6bb4d`).**

Evidence:

- `exterior-crops.png` (before | after): the woman's brown skin goes pale cream, the man's grey top and both figures' clothes go near
  white, and the man's hair goes from navy to bright cyan. A light that erases a character's skin tone is unacceptable.
- `measurements.json`, exterior, both figures: key `2|-|-4,6,3;10`, flat `1.3689` (= 1.17²), exposure 0.
- The cause, in `room-light.ts`: the sun's level × colour is added to the flat light (`flat = tint + sunLight`). By day that peaks
  over 1.37, and `flatSteps` rounds it to `+2`, `SPRITE_STYLE.up`'s ceiling. The ring of ground also takes the sun (`sunLight × pull`),
  so the figure is never more than `hot` steps over it, and the exposure stays 0.
- The probe: over the whole exterior grid every point is `+2` (2,401 of 2,401).
- The README's "if it reads too bright, the cap is one step off `ROOM_LIGHT.hot`" names a lever that cannot help, because the ring
  holds the sun too. Plan Task A7 Step 2's check "the exterior figure is not washed out" was recorded as passed.

Why it is wrong: FB's painted cell already is the daylight look, because the painter's own key light models day. A flat lift over it
adds light the painter already put in.

Suggested fix (AF only; `lightSprite` stays general):

- Hold the flat light at or under the painted cell. In `roomLight`, `held = Math.min(0, steps − exposure)`, as a named
  `ROOM_LIGHT` field, for example `lift: 0`.
- Keep the sun in the flat light, so by day the figure is about 0 steps and not the old −3 and blue, and keep it as a lamp.
- Rooms darker than day still pull the figure down. Lamps add form (+1 on the lit side) and rim (+1), never flat lift above 0.
- Tests in `room-light.test.ts`:
  - `'by day the flat light is the painted cell: 0 steps'`;
  - `'a lamp at the ceiling of light adds form and rim, never flat steps over 0'` (`tint = () => [1.6, 1.6, 1.6]`: key starts `0|`).
- Re-shoot the exterior pictures, fix the README line, and state the rule in the kit's README: a figure is never lit above its
  painted colours; a dark room takes it down; a lamp gives it a side and a rim.

The interior under the fix: unchanged. Over the interior grid the held steps are −3 (2,108 points), −2 (250), −1 (38) and 0 (5),
never above 0, so `min(0, …)` changes no interior key. The gate's interior keys (stander `0|16,13,7|0,8,0;15`, walker `-2|…`) stay as
they are, and so do the interior pictures, the walk strip and the bench's scenarios (all interior). The parity case is two figures
under a warm lamp, and its frame equals `compose` whatever the light, so it holds by construction. Re-run it all the same.

**B2. The bench numbers in the docs are not the ones in `measurements.json`, and the artifact's flicker median is over the budget.**

Evidence:

- `eae6bb4d` re-ran the gate and rewrote `measurements.json`. Its bench now reads:

  | Scenario | Median (ms) | p95 (ms) | Worst (ms) |
  | -------- | ----------- | -------- | ---------- |
  | steady   | 1.96        | 4.67     | 8.90       |
  | switch   | 0.24        | 4.47     | 13.03      |
  | flicker  | **2.31**    | 5.43     | 9.28       |

- The gate README's table, which says "every number below is copied from `measurements.json`", still shows the earlier run at
  `7abb312e`: steady 1.84 / 4.32 / 14.46, switch 0.31 / 4.29 / 7.59, flicker 2.00 / 4.35 / 7.52. Spec section 11 and progress rows
  10 and 11 quote those numbers too ("steady 1.84, switch 0.31, flicker 2.00").
- The coordinator accepted "the medians" on numbers the artifact no longer holds, and in the artifact flicker's median is over the
  2 ms budget.
- My run at the same head (Node 22.23.4, linux x64): medians 1.56 / 0.25 / 1.74, worst **42.93** / 11.60 / **43.62**. The worst
  frame is not "6 to 14 ms", as spec section 11 and progress row 11 record the risk. It reached 43 ms here. hits and misses are
  identical in every run (3240/1560, 3439/1361, 2556/2244), so the light itself is deterministic, and the spread is the machine's.

AGENTS.md: facts come from artifacts.

Suggested fix:

- Run the bench three times and commit the JSON of the run the docs quote, or all three. Write the README table, spec section 11 and
  progress rows 10 and 11 from that file.
- Restate the risk with the measured range (worst 7.5 to 43.6 ms over the three recorded runs; flicker's median 1.74 to 2.31 ms, around the
  budget).
- Ask the coordinator to confirm the acceptance against those numbers.

## Should-fix

**S1. The kit's WebGPU cases never run in CI.** The kit's `test:browser` is `vitest run --project browser`, and
`test:browser:3d` (`3d.yml`) runs that script. `packages/3d`'s is `--project browser --project webgpu`. So the three WebGPU parity
cases (wall, overlap, lit) and the WebGPU gate run only by hand. Plan Task A5's evidence has no CI behind it.

Fix: make the kit's `test:browser` `--project browser --project webgpu`, as `packages/3d` has it. The cases skip, in words, where no
adapter is granted. On a machine without a GPU, run them with `AF_WEBGPU=software`.

**S2. The committed bench asserts a budget the coordinator ruled unmet, so it always fails.** `lit.bench.test.ts` asserts
`worst <= 6` in each scenario. Every run so far misses it (7.5 to 43.6 ms), and mine exited 1. A test that is red on its reference
machine teaches people to ignore it.

Fix: keep the median assertion. Record the worst frame in the JSON without asserting it, or assert a ceiling the coordinator names,
and say so in the file's header, with the ruling.

**S3. The pin is FB's branch head, and one record names another commit.**

- `vendor/FigureBuilder` is `7797d4a`, PR #28's head, not FB `main`'s merge. Plan Task A1 Step 2 is open, rightly.
- `docs/refactor/c8/runway-hair-poles/README.md` says the submodule moved to `d5ca055`. The pin is `7797d4a`. The three later commits
  change only `sprite.ts`, and `showcase-cells` passes at `7797d4a` here and on the Macs, so the golden holds.

Fix:

- Before #607 is marked ready: merge FB #28, move the pin to `main`'s merge commit (a squash merge gives a new SHA), and re-run
  `showcase-cells` and the Macs' `checks`.
- Correct the README's SHA (or say it was recorded at `d5ca055` and holds at `7797d4a`).

**S4. The rim rule as built is documented in code, not in the spec or the contract.**

- `lightSprite`'s TSDoc (rule 4) and the plan's log say what was built and ruled: the rim is the first texel in from the painter's
  outline (empty beside it, or empty past one held texel), and a texel with no normal gets no rim.
- Spec section 5a rule 4 still says "a filled texel with an empty 4-neighbour", and FB `docs/contract.md` section 3 says only
  "a rim". `SpriteStyle.rim`'s doc says "a silhouette texel".

Fix: amend spec rule 4, marked "changed at execution". Add one sentence to contract section 3 and to `SpriteStyle.rim`'s doc.

**S5. `sprite.json`'s move was not in the audit the coordinator ruled on, and FB's CLAUDE.md omits it.**

- The audit folder `docs/superpowers/audits/c8-hair-poles/` (commit `4149a7c`) predates `sprite.json` (`5e4ba04`), and its
  `summary.json` has no `sprite` entries.
- `d5ca055` then moved 22 of `sprite.json`'s 64 frames, 3 of them base-m (the ears). The commit body says so; its subject and FB
  `CLAUDE.md`'s goldens paragraph ("base-f's cells in the base, lit, actors and sprites goldens, … and two base-m lit cells") do not.
- The ruling "ACCEPT, all of it" covered what was shown.

Fix: add the 22 frames to the audit folder (before | after | changed texels) and show them to the coordinator. Add one clause to
`CLAUDE.md`: `sprite.json`, recorded before the rule, moved with it, 22 of 64 frames, 3 base-m.

**S6. The runway re-record broke plan audit B4's acceptance rule, and no ruling on it is recorded.** B4 accepts a moved texel when
it is the hair's and no darker than the same hair's texels beside it. `runway-hair-poles/README.md` reports 12 texels darker than
every unchanged hair neighbour (`sam/heavy/0` 4, `june/short/0` 3, and five cells with one each), accepted "as the same shade swaps
the coordinator accepted in FigureBuilder's audit". The coordinator ruled on FB's goldens, not AF's runway golden, and neither
progress nor the plan log records a ruling on these 12.

Fix: show the coordinator the four `runway-moved-*.png` sheets with the 12 texels named, and record the ruling in the plan's log
and progress row 10.

**S7. The kit's README promises more than the rule does.** It says "a figure under a lamp is never hotter than the floor beside it".
The rule holds the figure within `ROOM_LIGHT.hot` (1) step of the ring: one step hotter is allowed. And by day (B1) it is two over
its painted cell.

Fix: say what the rule is: at most one step over the ground round its feet, and (after B1) never above its painted colours.

## Nice-to-have

**N1.** `painted-stage.ts` has `const WEBGPU = 2`, and FB's `stage-view.ts` compares `renderer.type === 2`. Import Pixi's
`RendererType` so a renumbering cannot pass silently.

**N2.** `cell-template.ts` says the template is the original "with four edits"; `template.test.ts`'s header says "three edits"
(and undoes four). Make them agree.

**N3.** The packed depth relies on the host's byte order: a `Float32Array`'s bytes are uploaded as they lie and decoded
little-endian in WGSL. Every WebGPU platform is little-endian today. One comment line in `cellDepthBit` would say so.

**N4.** `litCells` drops the oldest entry, first in first out. A hit does not refresh it, so a walk cycle that crosses more than 32
light keys thrashes. Re-inserting on a hit is two lines. Its key hashes the painted colours and the light. It does not hash the
normals (the plan accepted this) or `pitch`, which `lightSprite` also reads. Say so in the module's comment.

**N5.** In `measurements.json` the `before` entries carry the key each figure would have been lit with, although "before" is drawn
with `lit: false`. Label them, or drop them.

**N6.** The records lag the work.

- The plan's boxes for steps that did run are open: A2 Step 6 (now evidenced), A6 Step 2, A7 Steps 3 and 4 (the checkpoint was
  held), and A8 Step 1 (the README and status lines are written).
- Progress row 10 says the browser project skips 1. It skips 2 since `gate-lit` was added.
- FB's PR body says the F1 commit ran "the subset of cases that draw base-f": true, and the full suite at the head is 561 of 561.
