# M3.7b: base-3d part 2, the playable first slice (TDD plan)

- **Task:** M3.7b in `docs/02-master-delivery-plan.md` (size L). Spec: [M3 spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.2, §4.4.5, §4.7, §5, §6, §7, §8, §13 (B-a, B-b, I-g, I-k); base-3d's [DESIGN.md](../../../games/base-3d/DESIGN.md) §3.1, §11, §13, §14.
- **Prerequisites:** M3.7a (#250, merged), M3.5d (#270, merged), M3.5d part 2 (#274, merged), M3.4c, M3.4d, M4.12 (on main). **M3.6d `evaluate()` (#276) must merge before part 2.** GL.7 part 1 (#279) should merge before part 3, so the page code lands in `src/main.ts` and `src/views.ts`; part 1 merges main in when #279 lands.
- **Lane:** 3D (session `session_01QYLU1fsuzzCNWoc84uTypf`). Branches `claude/3d-m3-7b-*`, one worktree each under `/home/user/wt/`.
- **Acceptance:** B-a (golden identical in four engines, kept), B-b (boots under the fake host and Ruken's local stack, nothing renders before ready, zero CSP violations); the clip behaviour cases I-g and I-k hold through the view (their unit proof is #276's).
- **Core only** (decision 7): no Plus package; the `post-retro` chain is M3.7c's game-code look.

## Split (each part is one PR, reviewable alone)

| Part | Branch | What | Needs |
|---|---|---|---|
| 1 | `claude/3d-m3-7b-actions` | Sim: Wick's actions (slash, point, pickup) and guard stance; golden replay extended | main |
| 2 | `claude/3d-m3-7b-figure-evaluate` | render-pixi3d's figure view on figures' `evaluate()`; Wick and the target as figure content with the pose library, four clips, a sword and a shield | #276 |
| 3 | `claude/3d-m3-7b-scene` | The page: two rooms, two views and the doorway cut, free rotation (drag, stick, keys), cut-away walls, a fading pillar, three GLB props, fog; the lock-on demo framed by the camera | parts 1, 2; #279 |
| 4 | `claude/3d-m3-7b-flow` | Splash, menu, room, pause, end; landscape only; e2e under the fake host and Ruken's local stack (B-b); review images | part 3 |

## Interfaces

**Consumed:** `@mcthaydt/automata-sim` (`defineCommand`, `defineComponent`, `defineSystem`); `@mcthaydt/automata-render-pixi3d/sim` (`CameraHeading`, `CameraTurn`, `enterView`, `mapStick`, `STICK_MAX`, `Q16`); `@mcthaydt/automata-render-pixi3d` (`createPixi3dRenderer`, `figure`, `mesh`, `box`, `cameraViewContent`, `sceneLightingContent`, occluders `wall`/`prop`/`ceiling`, `LOCK_SHARE`); `@mcthaydt/automata-figures` (`evaluate`, `FigureState`, `MotionLibrary`, `EvaluateOptions`, `FigureDef`, `FigureLibrary`, the `figure`, `figure-pose` and `figure-clip` content kinds); `@mcthaydt/automata-game` (`defineGame`, `keys`, `startGame`, `defaultContent`, default screens); M4.12's touch overlay (stick and buttons) and `hostReserved`.

**Produced (game-local, not published):**
- `commands.ts`: `Act` `{ slash, guard, point, pickup: boolean }`, the buttons held, sent every tick as `lock` is; the sim finds the presses (`HeroControl.actHeld`, `actPressed`, as `ACTION_BITS`).
- `components.ts`: `HeroAction` `{ clip: u32 (0 none, 1 slash, 2 point, 3 pickup), startedAt: u32 (tick), guard: bool, guardSince: u32 (tick) }`, rendered (the sim has no `u8` field type).
- `constants.ts`: `ACTION_TICKS` per move (from the clips' lengths at 60 Hz) and `ACTION_CLIPS` (the clip id per code).
- `systems.ts`: `heroAct` (after `heroInput`): a press starts its action at `ctx.tick`; a slash may replace a running slash (the view blends, M3R-D16); point and pickup start only when nothing runs; an action ends `ACTION_TICKS` after its start; `the guard button held sets `guard` (and `guardSince` on the press) and its release clears it.
- `views.ts` (part 2): `figureStateOf(components, tick → seconds)`: `Hero` + `HeroAction` render rows to figures' `FigureState` (`moving`, `speed`, `facing` in radians, `moveDir`, `action`, `stances`, `aim` at the lock target's head and chest).
- render-pixi3d (part 2): `FigureViewOptions` gains `motion: MotionLibrary` in place of `gaits`, and `FigureViewState` becomes figures' `FigureState` minus `hair` (the view owns the spring and passes `hair`); the view passes `options.previous` (its last evaluated time) and one `warned` `Set` per figure. A published-export change: api-report updated, changeset for render-pixi3d only if it publishes (it is private, D-1: no changeset).

## Steps (strict TDD; tick each as its check passes)

### Part 1: actions in the sim
- [x] 1.1 Failing tests in `games/base-3d/src/game.test.ts`: a slash press sets `HeroAction.clip = 1` and `startedAt = tick`; it ends after `ACTION_TICKS.slash`; a second slash mid-swing restarts it; point during a slash is ignored; guard press/release sets and clears `guard`; actions are independent of lock and movement. Run `pnpm --filter @af-games/base-3d test:unit` → fails on the missing `Act`.
- [x] 1.2 Minimal code in `commands.ts`, `components.ts`, `constants.ts`, `systems.ts`, `state.ts` (register the defs, spawn `HeroAction`). Tests pass; `pnpm boundaries --game` passes.
- [x] 1.3 Golden: extend the replay script with a slash, a mid-swing slash, a guard hold and a pickup. The hash changes because the hero gains `HeroAction`; record old and new hashes here with that reason. `test:parity` in Chromium, WebKit and Firefox equals Node (B-a).
- [x] 1.4 `pnpm format`, `TURBO_FORCE=true pnpm check`; PR.

### Part 2: the figure view on `evaluate()`, Wick as content
- [x] 2.1 Failing tests in `packages/render-pixi3d/src/figure/figure-view.test.ts`: the view calls `evaluate()` with the row's action and stances (a slash row moves the right hand away from the locomotion-only pose); a sim-only missing clip warns once (one `warned` Set); `previous` advances; hair swings from the view's spring.
- [x] 2.2 Switch `figure-view.ts` from `evaluateMotion` to `evaluate()`; update `examples/figures/*` callers to `motion`. Tests pass; `pnpm api-report --update`, `pnpm agent-skills --write`.
- [x] 2.3 Content under `games/base-3d/src/content/`: `wick.figure.toml` (from `examples/figures/figures-walk.ts`'s Wick), `target.figure.toml`, `library.toml` (swatches; items `sword` and `shield`, which FigureBuilder's items library lacks: recorded as new), `figure-poses/*.toml` and `figure-clips/{slash,guard,point,pickup}.toml` (slash masks `armR` + `torso` and plays over the walk; guard is a stance). Failing content-compile test in `game.test.ts` first (each clip and pose compiles; a clip naming a missing pose fails).
- [x] 2.4 Failing tests for `views.ts` `figureStateOf`: tick to seconds at 60 Hz, turn units to radians, the slash row gives `action { id: 'slash', startedAt }`, guard gives `stances [{ id: 'guard', startedAt }]`, a lock gives `aim` at the target. Then the code.
- [ ] 2.5 Gates: check, render-pixi3d `test:parity`, `build:examples`; PR.

### Part 3: the scene
- [ ] 3.1 Props: three static GLBs from The Last Light (`add_repo` read, shallow clone; record the commit) into `games/base-3d/public/models/` with `PROVENANCE.md`; a failing test that `loadModels` parses each without a skin.
- [ ] 3.2 Failing tests for `views.ts` `sceneOf(area)`: one wall entry per area wall, a floor and ceiling per room, the pillar as a fading prop, the props placed; camera views come from the area; fog and lamps from `scene-lighting` content.
- [ ] 3.3 `src/main.ts`: `createPixi3dRenderer` with the hero and target figures, the scene, `camera: { views, follow: Hero.id }` with the lock frame; input: WASD and arrows (move), Q and E (`camera-turn`), Shift held (lock), J (slash), K held (guard), L (point), F (pickup); the touch stick and buttons on M4.12's overlay; the camera drag region outside controls and `hostReserved`. DOM tests for the key map; `pnpm build:demos`.
- [ ] 3.4 Review images (fake-host page in Chromium at 844×390 and 780×270): hall, doorway cut, kiln, a slash, guard, lock-on framing; committed under `docs/evidence/owner-visual/2026-10-30-m3-7b-scene/` with a README explaining each. PR.

### Part 4: flow, landscape and B-b
- [ ] 4.1 Failing DOM tests for the flow: splash → menu → room → pause (Escape, the pause button) → end (Wick picks up the ember in the kiln: a sim event `ember.taken` ends the run) → menu; portrait shows M4's rotate hint.
- [ ] 4.2 `games/base-3d/e2e/` (Emberwick's `e2e/host` pattern) and a `base-3d` project in `playwright.config.ts`: boots under the fake host, no canvas before ready, zero CSP violations; Ruken's local stack as Emberwick's check runs it. Focused run only: `pnpm exec playwright test --project=base-3d`.
- [ ] 4.3 Gates; review images under `docs/evidence/owner-visual/2026-10-30-m3-7b-flow/`; PR.

## Gates (each part)
`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @af-games/base-3d test:parity` (Chromium, WebKit, Firefox); parts 2 and 3: `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`, render-pixi3d `test:parity`, `pnpm build:examples`, `pnpm build:demos`; part 4: the focused e2e project. No changeset: base-3d, figures and render-pixi3d are private.

## Owner gates
Real-device play on a phone (landscape): the Owner's. Visual acceptance is recorded by the coordinator from the committed review images.

## Execution log
- 2026-10-30: plan written from origin/main `2aca6cd5`.
- 2026-10-30, part 1: 1.1 failing as expected (`act` rejected as `unknown-command`, 29 failures); 1.2 the commands, components, constants, `heroAct` and the state wiring, 42/42 node. Deviation: one `Act` command with the four buttons held (edge-detected in the sim, as `lock` is) in place of `Act` + `Guard`, so the input layer sends held state every tick and the sim stays the one place a press is found. `systems.ts` passes 300 lines (the GL spec's folder threshold, not checked by `pnpm style`): GAME-3D.1a splits it into `systems/`, as DESIGN.md §3.1 plans. 1.3 the golden hash `aa170b86451f0838` → `ce0f0628722db568`: Wick gained `hero-action`, `hero-control` gained `actHeld` and `actPressed`, and the route gained the action segments after the walk; the walk's kiln tick (118), locked ticks (50) and end position are unchanged and asserted. The route's action starts are asserted (`1@278`, `1@287`, `3@348`, `2@409`). `test:parity`: 108/108 in Chromium, WebKit and Firefox.
- 2026-10-30, part 2: split into **2a** (#282, render-pixi3d's figure view on `evaluate()`, steps 2.1 and 2.2; its evidence and gates are in #282) and **2b** (this branch, steps 2.3 and 2.4, stacked on #280 and #282 until they merge). 2.3 failing first (no `figure` content), then the content under `games/base-3d/src/content/` (DESIGN.md §3.1's `content/`; the compile root is `src/`): Wick and the target (figures' fixture Wick and keeper at `077484c7`, headers rewritten) with every library file they name, copied from the same fixtures; the poses `guard-high`, `guard-low`, `point`, `stand`, `free` (copied) and `pickup-low` (new); the clips `slash` (the fixture slash retimed to 0.4 s), `guard` (the fixture raise-guard), `point` and `pickup` (new); the items `sword` and `shield` (new: FigureBuilder's items library has neither). `content.test.ts` checks the compile, the four clips, and each action clip's length against `ACTION_TICKS`. 2.4 `views.ts` `heroFigureState` with `views.test.ts` (4 cases). Deviations: (1) a figure holds one item, in its `hand`, so Wick shows the sword and the shield is authored but not held until figures gains a second hand's item (follow-up for figures, Owner's veto); (2) the guard stance is dropped from `stances` on release, with no `endedAt`, so it cuts out rather than blending out over `outMs` (the view would need to remember the release: follow-up in part 3); (3) until #279 lands, `pnpm boundaries` scans all of base-3d's `src/`, so `views.ts` spells 2π out and lists the clip ids by hand. Gates: `TURBO_FORCE=true pnpm check` green; base-3d node 48/48.
