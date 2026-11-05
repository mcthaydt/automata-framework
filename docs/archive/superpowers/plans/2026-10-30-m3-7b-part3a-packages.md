# M3.7b part 3a: the package additions the base-3d scene needs (TDD plan)

- **Task:** M3.7b part 3 in `docs/02-master-delivery-plan.md`, split out of its [plan](./2026-10-30-m3-7b-base3d-first-slice.md) step 3.3 because the scene needs three things no package has. Part 3b (the scene in `games/base-3d`) builds on this. Spec: [M3 spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.2 (camera, lock-on framing), §6 (`ModelInvalid`); [M4 spec](../specs/2026-10-16-m4-input-display-design.md) §16.4 ("the game's command mapping … per fixed step").
- **Lane:** 3D (session `session_01QYLU1hJWsuzQPvjbezw4wi`). Branch `claude/3d-m3-7b-scene-packages`, worktree `/home/user/wt/m3-7b-pkgs`, from origin/main `2910a11b`.

## Why

1. **Several commands per tick.** `keys(command, …)` makes an `InputMap` that sends one command. base-3d's sim takes `move`, `lock`, `act` and `camera-turn` as separate commands (part 1). `defineGame` takes one `InputMap`, and a game imports only the game package, never the runtime, so the join belongs in `@mcthaydt/automata-game`.
2. **Static props.** The `scene` hook builds the static scenery but cannot draw a model file: only a view factory's `models` are loaded. Three GLB props as sim entities would change the golden for scenery; the hook gets the loaded library instead.
3. **A fixed-point player and lock-on framing.** The camera driver reads `x`, `y`, `z` metres from the `follow` component; base-3d's `hero` holds Q16.16 metres. Nothing calls the rig's `frame(lock)`, and the lock target is another entity.

## Interfaces

**Produced:**
- `@mcthaydt/automata-game` (published; patch changeset with the umbrella): `inputs(...maps: InputMap[]): InputMap`. Each map sends its own command every tick in map order, from one Input over the merged profile (`id` the command ids joined by `+`); `seq` is `tick × maps.length + index` (the sim rejects a duplicate seq from one source); `command` is the first map's; touch buttons and labels merge in order; `touchMode` is `swipe` only when every map's is. Throws on no maps, a command mapped twice, and an action id, a key or a pad button two maps share.
- `@mcthaydt/automata-render-pixi3d` (private, D-1; no changeset): `Pixi3dOptions.models?: string[]`, loaded with the views' files; `scene` gains a fifth argument, `models: ModelLibrary`. `Pixi3dCameraOptions.position?(components) → Vec3`, the followed point in metres (default the `follow` component's `x`, `y`, `z`), interpolated between ticks; `Pixi3dCameraOptions.lock?(components, rowOf) → Vec3 | undefined`, read each frame and passed to `rig.frame`; with it the driver keeps every row's components by sid.

**Consumed:** runtime `makeInput`, `inputProfileSchema`, `touchModesFor`; render-pixi3d `loadModels`, `CameraRig.frame`.

## Steps (strict TDD)

- [x] 1. `packages/game/src/input/inputs.test.ts`: construction (no maps, a command twice, a shared key, merged profile, buttons and labels, a touch-off map, swipe mode) and commands (pure `toCommand` with seqs; attached: keys and touch buttons through one Input). Failed on the missing module; `inputs.ts` then 8/8.
- [x] 2. `packages/render-pixi3d/src/camera/camera-driver.test.ts`: a `position` reader followed and interpolated; `lock` frames the target found by sid, clears when the lock or the target goes, frames nothing before the player's row and forgets rows on a resync. 3 failures as expected; then 14/14.
- [x] 3. `create-pixi3d-renderer.test.ts`: a skinned scene model fails boot with `ModelInvalid` (failed: the file was never loaded); `renderer.parity.test.ts`: the `scene` hook gets the library with its file. Then 4/4 node; parity 19 passed, 14 skipped (Firefox here has no WebGL) in Chromium, WebKit and Firefox.
- [x] 4. Gates (below), api-report, agent-skills; PR.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report --update`; `pnpm api-index`; `pnpm agent-skills --write`; `pnpm changeset status --since=origin/main`; `node tooling/release/src/check-changesets.ts`; `pnpm --filter @mcthaydt/automata-render-pixi3d test:parity`; `pnpm --filter @mcthaydt/automata-game test:parity`.

## Execution log

- 2026-10-30: written and executed; results in the PR body.
- 2026-10-31, review of #289 (coordinator): `bindings` and `labels` merged with `Object.assign`, so an action id two maps define would lose the earlier map's binding silently. A failing test first (a hand-made map whose actions are named after another command: `expected [Function] to throw`), then `checkShared` throws on a shared action id; 9/9.
