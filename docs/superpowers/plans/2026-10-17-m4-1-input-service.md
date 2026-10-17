# M4.1 `Input` service and bindings: TDD plan

- **Task:** M4.1 in [02](../../02-master-delivery-plan.md). M4 spec [§4.1, §4.2, §4.13](../specs/2026-10-16-m4-input-display-design.md), §5 (boot, per fixed step, lifecycle) and §6. Acceptance I-a, I-b, I-g and I-j.
- **Lane:** runtime, with one change to the game lane (step 3, the change request in spec §2.2). **Depends on:** M4.0 (`8a345a1`), PRODUCT.1 (input profile) and DX.2 (`InputMap`), all merged.
- **Status:** In progress.
- **Progress:** 2 of 8 steps.

## Sources, read at these commits

- **FloorFifty `apps/client/src/managers/input.ts` at `ac72660`** (217 lines) and `tests/client/managers/input.test.ts`.
  - Per-device held sets (lines 42–60). A keyup on one device never releases what another holds.
  - The union is what is sampled.
  - A key repeat changes nothing.
  - A blur releases the keyboard only; a pad re-asserts what it holds on its next poll.
  - The latched presses (reset, fast-fall) are race-specific and stay in FloorFifty. AF keeps edges out of the sim command stream (DX spec §3.3), so `onPress` edges are UI-only.
- **The Last Light `src/input.ts` at `17eb568`** (137 lines). It has `stickVector` (radius, dead zone 0.25) and `swipeTurn` (48 px, 600 ms).
  - Both belong to M4.2 (sticks) and M4.3 (gestures); M4.1 takes nothing from them.
  - This read discharges the spec's "not re-surveyed" note (§0) for M4.1.
- **DX.2 `packages/game/src/input/keys.ts` on `main`** (181 lines). `keys()` merges held payloads in press order (a later press wins per field), sends what is held and never an edge, and polls standard-mapping pads once per tick. **It has no `InputProfile` and no pure `toCommand`.** That is the case spec §2.2 and §14 name, so step 3 is the change request to the game lane, made in this PR because that lane's owner is this session. No second mapping is added.

## Scope

**In:**

- The binding fields and reserved inputs (§4.1).
- `InputMap.profile` and `InputMap.toCommand` (§2.2).
- The `Input` service core: per-device held sets, the union `held()`, keyboard, touch and standard-pad *button* sources, `onPress` edges for the fixed menu actions, `context`, `device`, `profile`, and release on blur and on the hidden lifecycle. The service publishes the `input.device.changed` fact.
- The play screen sampling through it (§5, per fixed step).
- The manifest `inputs` check (§4.13, I-g).
- The I-a parity golden.

**Out, each in its owning task:**

| What | Task |
|---|---|
| `stick()` values, the radial dead zone, `pads` and hot-plug, the `input` pause reason | M4.2 |
| Gestures | M4.3 |
| `rebind`, `capture`, `resetBindings`, saved overrides through `Settings`, and `input.bindings.changed` | M4.4 |
| Focus navigation driven by menu actions | M4.5 |

Until those land, `stick()` returns `{ x: 0, y: 0 }`. Every later addition to the `Input` interface is additive, and `runtime` is private, so no API break.

## Contract

### Bindings: `packages/runtime/src/input/input-profile.schema.ts`, extended

```ts
export type StickDirection = `${'left' | 'right'}-${'up' | 'down' | 'left' | 'right'}`
export type GestureName = 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'flick-down' | 'tap'
export interface InputBinding {
  readonly keys: readonly string[]
  readonly pad: readonly number[]
  readonly touch: boolean
  readonly stick?: readonly StickDirection[]
  readonly gesture?: readonly GestureName[]
  readonly required?: boolean
  readonly context?: 'play' | 'menu' | 'any' // default 'play'
}
export const RESERVED_PAD_BUTTONS: readonly number[] // [8, 16] (M4-D3)
export const RESERVED_KEYS: readonly string[]        // ['Escape', 'Tab'] (M4-D3)
```

- `inputProfileSchema` refuses a reserved key or pad button in any binding. Its issue names the action, for example `bindings.jump.pad: 8 is reserved (the host's View button)` (I-j).
- PRODUCT.1 is merged and `runtime` is private, so this refinement narrows an unreleased schema. The API report records it.

### Menu actions: `packages/runtime/src/input/menu-actions.ts`

```ts
export type MenuAction = 'nav-up' | 'nav-down' | 'nav-left' | 'nav-right' | 'confirm' | 'back' | 'page-prev' | 'page-next' | 'adjust-dec' | 'adjust-inc' | 'pause'
export const MENU_BINDINGS: Readonly<Record<MenuAction, { readonly keys: readonly string[]; readonly pad: readonly number[] }>>
```

- **Keyboard:** the arrows, Enter and Space confirm, Escape backs out, and Escape pauses.
- **Pad:** the defaults come from FloorFifty `gamepad-source.ts` line 39 (`B` table), with the D-pad 12–15, A 0, B 1, LB/RB 4/5, LT/RT 6/7 and Start 9 for `pause`.
- Reserved keys are allowed here: the reserved list applies only to a game's profile.

### `InputMap` (game lane): `packages/game/src/input/keys.ts`

```ts
export interface InputMap {
  readonly command: CommandDef
  readonly touch: boolean
  readonly touchButtons: readonly TouchButton[]
  /** One action per distinct payload, id `<command.id>-<n>` in binding order; keys, pad buttons, touch. */
  readonly profile: InputProfile
  /** Pure: the one command for the held actions, merged in iteration order (a later press wins per field). */
  toCommand(held: Iterable<string>, tick: number): readonly Command[]
  attach(target: Window): InputSource // kept: now the Input core plus toCommand, so Emberwick is unchanged
}
```

- **Touch buttons.** `TouchButton.id` becomes the action id: `move-0` instead of `touch-0`. The ids are only in `keys.test.ts`, `screens.layout.test.ts` and `default-screens.test.ts`; no E2E spec or golden names them.
- **Merge order.** `toCommand` merges in the order its argument iterates. `Input.held()` iterates in first-press order, which keeps DX.2's "later press wins" rule.

### `Input`: `packages/runtime/src/input/input.manager.ts`

```ts
export type InputDevice = 'keyboard' | 'gamepad' | 'touch'
export interface Input {
  held(): ReadonlySet<string>                                        // union over devices, first-press order
  stick(side: 'left' | 'right'): { readonly x: number; readonly y: number } // {0,0} until M4.2
  onPress(action: MenuAction, listener: () => void): () => void      // edges, never sent to the sim
  poll(): void                                                       // reads pads; the loop calls it once per fixed step
  hold(action: string): void                                         // touch
  release(action: string): void                                      // touch
  setContext(context: 'play' | 'menu'): void
  readonly device: Subscribable.Subscribable<InputDevice>
  readonly profile: Subscribable.Subscribable<InputProfile>
}
export const Input: Context.Tag<Input, Input>
export function makeInput(options: { readonly target: Window; readonly profile: InputProfile }):
  Effect.Effect<Input, never, PresentationBus | Scope.Scope>
```

- **Plain functions.** `held`, `poll`, `hold` and `release` are plain functions with no Effect per call (ADR 0003). The sets are preallocated and cleared, never rebuilt per step.
- **Context.** `'play'` releases every held action and drops new presses of actions whose `context` is `'menu'`. `'menu'` does the same for `'play'` actions. `'any'` is always live. Menu actions fire `onPress` only in `'menu'`, except `pause`, which also fires in `'play'`.
- **Device.** The device is the last device with a real input: a key, a touch hold, or a pad button. The initial device is `touch` when `(pointer: coarse)` matches, else `keyboard`. A change publishes `input.device.changed` on the `PresentationBus`.
  - Under Ruken, `Hosting.input` as a source and the glyph family wait for M4.2, where pads arrive. `Hosting` is not a requirement of M4.1.
- **Release.** A window blur releases the keyboard and touch sets (FloorFifty: the pad re-asserts on its next poll). `document.visibilityState === 'hidden'` releases every set.
- **Scope.** Closing the scope removes every listener (§5, restart and dispose).

### Manifest inputs: `packages/ship/src/manifest/check-inputs.ts`

```ts
/** What ship reads of a game's input profile: the fields `runtime.inputs` must agree with. */
export interface ShipInputBindings { readonly [action: string]: { readonly pad?: readonly number[]; readonly touch?: boolean; readonly gesture?: readonly string[] } }
export function inputsProblems(inputs: readonly string[], bindings: ShipInputBindings): string[]
```

- **Why ship has its own type.** `ship` is published and `runtime` is private, so `ship` cannot import `InputProfile`. `ShipInputBindings` is the read-only subset ship consumes, not a copy of the contract: a profile's `bindings` is assignable to it structurally. A test in `game` asserts that assignability, so the two cannot drift.
- **Config.** `ShipConfig` gains an optional `input?: { readonly bindings: ShipInputBindings }`. Without it, nothing is checked, as today.
- **Prepare.** With it, `prepareBuild` fails with `ManifestInputsMismatch`, a new tagged error, before writing `ruken.toml`. For example: "action jump binds pad buttons but runtime.inputs has no \"gamepad\"" (I-g), or "runtime.inputs declares \"touch\" but no action binds touch or a gesture".
- **`automata check`.** The check (DX.6) runs the same function over the config it already loads in `csp-probe-live.ts`.

## Files

| File | Change |
|---|---|
| `packages/runtime/src/input/input-profile.schema.ts`, `input-profile.test.ts` | Fields, reserved lists, refinement |
| `packages/runtime/src/input/menu-actions.ts`, `menu-actions.test.ts` | Create |
| `packages/runtime/src/input/input.manager.ts`, `input.test.ts` | Create |
| `packages/runtime/src/index.ts`, `index.test.ts`, `public-seams.test.ts` | Export |
| `packages/game/src/input/keys.ts`, `keys.test.ts` | `profile`, `toCommand`, `attach` over the Input core |
| `packages/game/src/input/keys.parity.test.ts` | Create (I-a, browsers) |
| `packages/game/src/screens/default-screens.ts`, `default-screens.test.ts`, `screens.layout.test.ts` | Play screen samples through `Input`; touch ids |
| `packages/ship/src/manifest/check-inputs.ts`, `check-inputs.test.ts`, `config/ship-config.ts`, `errors.ts`, `prepare/prepare-build.ts`, `prepare/prepare-build.test.ts` | I-g |
| `packages/cli/src/check/csp-probe-live.ts` and its test | `automata check` runs the inputs check |
| `examples/core/core-input-keys.ts` | Adds a pad binding, so the example shows one action on three devices (the golden is unchanged: the replay holds commands) |
| `tooling/api-report/reports/{runtime,game,ship,automata}.api.md`, `.changeset/m4-1-input.md` | Reports; a changeset for `ship` (minor, additive) |

## Steps

The pre-commit hook runs the affected unit tests, so each red test is committed together with the code that turns it green. Each step records the red output it saw.

1. [x] **Plan.** This file, committed first.
2. [x] **Bindings (I-j).**
   - **Red:** in `input-profile.test.ts`, the optional fields parse and default; `required` and `context` round-trip; `RESERVED_PAD_BUTTONS` equals `[8, 16]` and `RESERVED_KEYS` equals `['Escape', 'Tab']`; a binding with pad 8, pad 16, `Escape` or `Tab` fails with the action named in the issue path and message.
   - **Run:** `pnpm --filter @mcthaydt/automata-runtime exec vitest run --project unit src/input/input-profile.test.ts`. Expect it to fail on the missing exports and on a parse that should fail.
   - **Green:** extend the schema.
   - Done: red was 7 failed (the missing `RESERVED_*` exports, `stick`/`gesture`/`required` dropped by the parse, reserved bindings accepted); then 10 passed. `index.test.ts` was red on the two new names, then green. The API report records the new fields and constants.
3. [ ] **`InputMap.profile` and `toCommand` (the §2.2 change request).**
   - **Red:** in `keys.test.ts`:
     - The profile has one action per distinct payload, with keys, pad buttons and `touch` set.
     - Touch button ids equal the action ids.
     - `toCommand(new Set(['move-1']), 3)` gives one `move` command with that payload at tick 3.
     - Two held actions merge with the later one winning per field.
     - An empty set gives the idle payload.
   - **Green:** derive the profile and add `toCommand`, implemented by the same merge `attach` uses. Move the touch ids in `screens.layout.test.ts` and `default-screens.test.ts`. The existing `attach` tests stay green unchanged, apart from the ids.
4. [ ] **`Input` core (I-b).**
   - **Red:** in `input.test.ts`, under jsdom, with a stub `getGamepads` and the `PresentationBus` test layer:
     - A key and a pad button bound to `jump` both held: releasing the key keeps `jump` held (I-b).
     - A key repeat changes nothing.
     - Blur releases the keyboard and touch but not the pad, which its next `poll` re-asserts.
     - Hidden visibility releases everything.
     - `held()` iterates in first-press order.
     - `hold` and `release` for touch.
     - `setContext('menu')` releases play actions and `onPress('confirm')` fires once per press, not per held step; `pause` fires in `play`.
     - `device` follows the last real input and publishes `input.device.changed` once per change.
     - Closing the scope removes the listeners: a later key does nothing.
     - A non-standard pad is ignored.
   - **Run:** `pnpm --filter @mcthaydt/automata-runtime exec vitest run --project unit src/input/`. Expect it to fail because `input.manager.ts` does not exist.
   - **Green:** create `menu-actions.ts` and `input.manager.ts`; export them from `index.ts`, with `index.test.ts` and `public-seams.test.ts` red first.
5. [ ] **Play screen and `attach` through `Input`.**
   - **Red:** in `default-screens.test.ts`, the play screen samples one command per step from a key and from a touch button through the service. An Escape press pauses through `onPress('pause')`. Leaving play closes the service, so a key after leaving does nothing.
   - **Green:**
     - The play screen builds `makeInput` in its scope and passes `commands: (tick) => (input.poll(), game.input.toCommand(input.held(), tick))`.
     - The touch buttons call `input.hold` and `input.release`.
     - The Escape and `KeyP` listener becomes `onPress('pause')` plus `KeyP`, which the game's own profile may bind.
     - `keys().attach` builds the same core in a private scope it closes on `dispose`.
   - **Emberwick check:** Emberwick (`games/emberwick`) still uses `attach`. Its golden (`games/emberwick` golden run) must stay unchanged. Any mismatch is investigated, never rebaselined.
6. [ ] **Manifest inputs (I-g).**
   - **Red:** `check-inputs.test.ts`:
     - pad buttons without `gamepad` fail, naming the action and `runtime.inputs`;
     - `touch` declared with no touch or gesture binding fails;
     - a consistent pair passes;
     - no `input` in the config checks nothing.
   - **Red:** `prepare-build.test.ts`: prepare fails with `ManifestInputsMismatch` and writes no `ruken.toml`.
   - **Red:** the `csp-probe-live` test: `automata check` reports the same problem.
   - **Red:** a type-level test in `game` (`keys.test.ts`): `keys(...).profile.bindings` is assignable to `ShipInputBindings`.
   - **Green:** add the check, the config field, the error, and the wiring. Emberwick's and the placeholder's `ship.config.ts` pass their input map's bindings, and their `prepare-ruken` stays green.
7. [ ] **I-a parity and the example.**
   - **Red:** in `keys.parity.test.ts` (Chromium, WebKit, Firefox) and its Node twin in `keys.test.ts`, one scripted 120-tick run three times:
     - by keyboard events;
     - by a stub standard pad;
     - by touch holds.
   - Each run goes through `Input` and `toCommand` into a `createSim` of `core-input-keys`'s plugin. The three command streams are equal, and the final `sim.hash()` equals a pinned value. The value is generated by the Node run and committed in the test with the command that produced it, and the browsers must match it bit for bit.
   - **Green:** no product change is expected. A mismatch is a defect to find.
   - **Example:** `examples/core/core-input-keys.ts` gains `pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } }`. Its header `Shows` names the three devices. The catalog test, `build:examples` and the `core-input-keys` golden replay stay green unchanged.
8. [ ] **Verify and record.**
   - `pnpm format` and `pnpm check` (`TURBO_FORCE=true`).
   - The CI checks-job extras, including the changeset status, `api-report`, `build`, `test:dist` and `prepare-ruken` for both games.
   - `pnpm test:parity` and `CI=1 pnpm test:e2e`.
   - Tick the M4.1 row in 02, and record the evidence and commits in 02's execution record and in 03.

## Acceptance mapping

| Case | Test |
|---|---|
| I-a | `keys.parity.test.ts`, and the Node twin in `keys.test.ts` |
| I-b | `input.test.ts` |
| I-g | `check-inputs.test.ts`, `prepare-build.test.ts`, the `csp-probe-live` test |
| I-j | `input-profile.test.ts` |

Not covered here, by owning task:

| Cases | Task |
|---|---|
| I-c, I-d, I-e, M-b | M4.2 |
| I-f | M4.3 |
| I-h, I-i, I-k, I-l | M4.4 |
| F-a to F-c | M4.5 |

## Risks

- **Emberwick's golden.** `attach` changes underneath it. If the golden moves, the cause is found and fixed in the core, and the golden is never touched.
- **`visibilitychange` in jsdom.** jsdom lets `visibilityState` be defined on the document. The test sets it the same way `ui`'s `sleep when hidden` test does.
