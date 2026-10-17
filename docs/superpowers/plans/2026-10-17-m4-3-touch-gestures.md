# M4.3 Touch buttons and gestures: TDD plan

- **Task:** M4.3 in [02](../../02-master-delivery-plan.md). M4 spec [§4.4](../specs/2026-10-16-m4-input-display-design.md), §5 (device change), §6 (`TouchControls`, `SwipeSurface` rows) and §8. Acceptance I-f.
- **Lane:** runtime and ui, with the game lane's play screen and `keys()` as consumers (this session owns that lane). **Depends on:** M4.1 (`Input`, merged in #74).
- **Status:** In progress.
- **Progress:** 5 of 9 steps.

## Sources, read at these commits

- **FloorFifty at `ac72660`:**
  - `apps/client/src/systems/gameplay/swipe-tracker.ts` (109 lines) and `tests/client/systems/gameplay/swipe-tracker.test.ts`. The floating anchor trails the thumb at `saturationPx`, so reversing costs the same short move from anywhere. Only the first finger that may steer steers; any finger may flick. A flick is `flickPx` down inside `flickMs` (samples kept while `t - sample.t <= flickMs`). It emits a fast-fall pulse (press then release) that FloorFifty's `InputManager` latches until the next tick.
  - `apps/client/src/systems/gameplay/touch-controls.ts` (211 lines) and its test. `nearestTarget` measures to a button's edge; `StickyPointers` gives each finger one button and moves it on a slide, keeping it when the finger slides off everything; `PointerLatch` holds an action while any finger is on it and reports only real changes.
  - `apps/client/src/ui/components/TouchControls.svelte` (257 lines). Each side's group takes the pointers, reaches `STICKY_MARGIN_PX` past its buttons with an invisible `::before`, and captures the pointer, so the release always arrives. `touchstart`/`touchmove` are cancelled non-passively (Chrome's long-press buzz). The pressed style comes from the latch (`data-held`), not `:active`.
  - `apps/client/src/ui/components/SwipeSurface.svelte` (104 lines). It forwards pointer events to the tracker and draws a thumb-to-anchor line, faint inside the dead zone. "The lower half steers" is the race's rule and stays in FloorFifty; AF takes it as a `steers(x, y)` prop.
- **The Last Light `src/input.ts` at `17eb568`:** `swipeTurn(dx, dy, ms)` turns the camera once per swipe (48 px, mostly sideways, within 600 ms), judged on release. In AF that game binds `swipe-left`/`swipe-right` and reads the press edge, as gameplay reads every edge (M4.1: the sim compares this tick's command with the last). Its thresholds are its own tuning (`deadZonePx` 48). This read discharges the spec's "not re-surveyed" note (§0) for M4.3.
- **AF on `main` (`24db7b2`):** `Input.hold`/`release` already hold an action from a `touch:<action>` source. `InputBinding.gesture` and `GestureName` exist (M4.1) but nothing recognises a gesture. The default play screen draws its own touch buttons (one `pointerdown`/`pointerup` per button, no stickiness, no multi-finger latch).

## Scope

**In:** the pure `SwipeTracker` with tuning; gesture bindings reaching `Input` (held gestures and latched pulses); `touchModesFor`; the ui `TouchControls` (sticky, latched, 48 px, hidden without remount) and `SwipeSurface`; `keys()` gesture bindings; the default play screen on both components; the example `core/core-input-touch.ts`.

**Out, each in its owning task:**

| What                                                                                                              | Task  |
| ----------------------------------------------------------------------------------------------------------------- | ----- |
| The saved touch-mode setting and its row in the Controls section                                                  | M4.4  |
| Touch-overlay placement around corner controls, the ActionBar and `hostReserved`; the reduced (required-only) set | M4.7  |
| Page swipe on `[data-pager]` regions and the back gesture                                                         | M4.5  |
| Touch cells of the input × form-factor matrix                                                                     | M4.10 |

## Contract

### Gestures: `packages/runtime/src/input/gestures/swipe-tracker.ts` (create)

```ts
export interface GestureTuning {
  readonly deadZonePx: number; // 12
  readonly saturationPx: number; // 48
  readonly flickPx: number; // 40
  readonly flickMs: number; // 180
}
export const GESTURE_TUNING: GestureTuning;
/** Where gestures go: held while a finger steers, pulsed for a flick or a tap. */
export interface GestureSink {
  hold(gesture: GestureName): void;
  release(gesture: GestureName): void;
  pulse(gesture: GestureName): void;
}
export interface SwipeIndicator {
  readonly anchor: { readonly x: number; readonly y: number };
  readonly thumb: { readonly x: number; readonly y: number };
  readonly steering: boolean; // outside the dead zone on either axis
}
export class SwipeTracker {
  constructor(sink: GestureSink, tuning?: Partial<GestureTuning>);
  readonly tuning: GestureTuning;
  get indicator(): SwipeIndicator | undefined;
  down(
    id: number,
    x: number,
    y: number,
    t: number,
    options?: { readonly steers?: boolean },
  ): void;
  move(id: number, x: number, y: number, t: number): void;
  up(id: number, x: number, y: number, t: number): void;
  cancel(): void;
}
```

- **Times** are `PointerEvent.timeStamp`, passed in; the tracker reads no clock (§4.4). Tests feed samples.
- **Steering (held).** FloorFifty's floating anchor on both axes: `swipe-left`/`swipe-right` while the thumb is `deadZonePx` or more from the anchor on x, `swipe-up`/`swipe-down` likewise on y. Each is held, and released when the thumb comes back inside the dead zone, the finger lifts or `cancel` runs.
- **Flick (pulse).** `flick-down`: `flickPx` or more down from the highest sample in the last `flickMs`, by any finger. One pulse per flick; the samples restart after it (FloorFifty).
- **Tap (pulse).** **Not in either source; AF's own rule, for review:** a finger lifted within `flickMs` of landing that never left the dead zone of where it landed. It reuses `flickMs` and `deadZonePx` rather than adding tuning values. A steering finger that comes back to the anchor is not a tap (it left the dead zone).
- **I-f.** 40 px down within 180 ms pulses `flick-down`; 39 px within 180 ms, or 40 px over 181 ms, does not.

### Bindings: `packages/runtime/src/input/input-profile.schema.ts` (extend)

```ts
export function actionsForGesture(
  profile: InputProfile,
  gesture: GestureName,
): string[];
export type TouchMode = "buttons" | "swipe";
/** The touch modes a profile offers: `buttons` when an action binds `touch`, `swipe` when one binds a gesture. */
export function touchModesFor(profile: InputProfile): TouchMode[];
```

### `Input`: `packages/runtime/src/input/input.manager.ts` (extend)

```ts
export interface Input {
  // ...M4.1 unchanged
  /** Gestures from a `SwipeTracker`, as touch input: a held gesture holds its actions, a pulse holds them for one sample. */
  readonly gesture: GestureSink;
}
```

- Sources `gesture:<name>` (held) and `gesture:<name>:pulse`; device `touch`; the action's `context` applies as for any source.
- **Pulse latch.** A pulse is pressed at once and lifted by the second `poll()` after it, so the next sample (`poll()` then `held()`, once per fixed step) sees it exactly once, and a pulse between steps is never lost (FloorFifty's latch). A second pulse of the same gesture before its first is lifted keeps it one more sample.
- Blur releases `gesture:` sources with the keyboard and touch; hidden and `setContext` release everything (M4.1).

### ui: `packages/ui/src/touch/` (create)

```ts
// touch-controls.ts
export const STICKY_MARGIN_PX = 24
export interface TouchTarget { readonly action: string; readonly rect: { left; top; right; bottom } }
export function nearestTarget(x: number, y: number, targets: readonly TouchTarget[], margin?: number): string | undefined
export class PointerLatch { constructor(onInput: (action: string, active: boolean) => void); isHeld(action); press(action, pointerId); release(action, pointerId); releaseAll() }
export class StickyPointers { constructor(latch: PointerLatch); down(pointerId, action): boolean; move(pointerId, action): void; up(pointerId): void; releaseAll(): void }
// touch-button.ts
export interface TouchButtonSpec { readonly action: string; readonly label: string; readonly ariaLabel?: string; readonly side?: 'start' | 'end' }
// swipe-surface.ts: what SwipeSurface drives, so ui need not import runtime (`SwipeTracker` satisfies it)
export interface PointerTracker { readonly tuning: { readonly saturationPx: number }; readonly indicator: SwipeIndicatorView | undefined; down(...); move(...); up(...); cancel(): void }
```

- `TouchControls.svelte`, props `{ buttons, onhold, onrelease, shown = true, testId }`. Each button is at least 48 px (primary size) and has `data-testid` = its action, `data-action`, `data-held`, `tabindex="-1"` (pointer only, never in the focus order, §6). Hidden with the `hidden` attribute when `shown` is false, so nothing remounts; going hidden and unmounting both release every held action.
- `SwipeSurface.svelte`, props `{ tracker, steers?: (x, y) => boolean, testId }`. Forwards `pointerdown/move/up` with `event.timeStamp`, `pointercancel` and `lostpointercapture` per finger (FloorFifty: one finger lifting must not stop the other steering), cancels `touchstart`/`touchmove` non-passively and draws the indicator.

### Game lane: `packages/game/src/input/keys.ts`, `screens/PlayScreen.svelte`, `screens/default-screens.ts`

- `KeysOptions.gestures?: Partial<Record<GestureName, Payload<Z>>>`, checked against the schema like a key; a gesture payload shares an action with an equal key payload.
- `KeysOptions.touchMode?: TouchMode`; `InputMap.touchMode`. Default `buttons` when the map has touch buttons, else `swipe`. The setting that changes it is M4.4.
- `InputSource.gesture: GestureSink`.
- The play screen draws `TouchControls` (touch mode `buttons`) or `SwipeSurface` over a `SwipeTracker` into `input.gesture` (touch mode `swipe`), while the player uses touch.

## Files

| File                                                                                                                 | Change                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/runtime/src/input/gestures/swipe-tracker.ts`, `swipe-tracker.test.ts`                                      | Create                                                                               |
| `packages/runtime/src/input/input-profile.schema.ts`, `input-profile.test.ts`                                        | `actionsForGesture`, `TouchMode`, `touchModesFor`                                    |
| `packages/runtime/src/input/input.manager.ts`, `input.test.ts`                                                       | `Input.gesture` and the pulse latch                                                  |
| `packages/runtime/src/index.ts`, `index.test.ts`                                                                     | Export                                                                               |
| `packages/ui/src/touch/touch-controls.ts`, `touch-controls.test.ts`                                                  | Create (ported)                                                                      |
| `packages/ui/src/touch/touch-button.ts`, `swipe-surface.ts`                                                          | Create (props types, kept out of `.svelte` so plain `tsc` consumers can import them) |
| `packages/ui/src/touch/TouchControls.svelte`, `touch-controls-view.test.ts`                                          | Create                                                                               |
| `packages/ui/src/touch/SwipeSurface.svelte`, `swipe-surface.test.ts`                                                 | Create                                                                               |
| `packages/ui/src/touch/touch.layout.test.ts`                                                                         | Create: 48 px buttons and no scroll at every reference size and variant              |
| `packages/ui/src/index.ts`, `index.test.ts`                                                                          | Export                                                                               |
| `packages/game/src/input/keys.ts`, `keys.test.ts`                                                                    | `gestures`, `touchMode`, `InputSource.gesture`                                       |
| `packages/game/src/screens/PlayScreen.svelte`, `default-screens.ts`, `default-screens.test.ts`, `screens.css`        | Both components                                                                      |
| `examples/core/core-input-touch.ts`                                                                                  | Create                                                                               |
| `tooling/api-report/reports/*.api.md`, `docs/cheatsheet.md`, the API index, agent skills, `.changeset/m4-3-touch.md` | Regenerated; a patch changeset for the published packages touched                    |

## Steps

The pre-commit hook runs the affected unit tests, so each red test is committed together with the code that turns it green. Each step records the red output it saw.

1. [x] **Plan.** This file, committed first (`b90ad9c`).
2. [x] **`SwipeTracker` (I-f).** Done: red was "Failed to resolve import ./swipe-tracker.js"; then 22 passed. FloorFifty's "two-finger tap no longer restarts" case is not ported: restart was its race's rule, and here a quick still finger is a `tap`.
   - **Red:** `swipe-tracker.test.ts`, FloorFifty's cases ported (dead zone, trailing anchor, release on lift, flick, slow drag, a non-steering finger flicks but never steers, the second finger steers after the first lifts, `cancel`), plus: I-f's three cases; up/down steering; a tap pulses `tap`; a long touch or one that left the dead zone does not; partial tuning overrides one value.
   - **Run:** `pnpm --filter @mcthaydt/automata-runtime exec vitest run --project unit src/input/gestures/`. Expect "Failed to resolve import ./swipe-tracker.js".
   - **Green:** create the tracker.
3. [x] **Gesture bindings.** Done: red was "actionsForGesture is not a function" (3 failed); then 13 passed.
   - **Red:** in `input-profile.test.ts`: `actionsForGesture` lists the bound actions sorted, none for an unbound gesture; `touchModesFor` gives `[]`, `['buttons']`, `['swipe']` and `['buttons', 'swipe']`.
   - **Green:** add both functions.
4. [x] **`Input.gesture`.** Done: red was 8 failed ("Cannot read properties of undefined (reading 'hold')" and "('pulse')"); then 60 passed in `src/input/`. `index.test.ts` was red on the five new names, then green (6 passed with `public-seams`). The latch is two sets swapped on each poll; nothing is allocated per step.
   - **Red:** in `input.test.ts`: a held gesture holds its action until released, and switches the device to `touch`; a pulse is in exactly one sample (`poll()` then `held()`) and gone by the next; a pulse between two polls is not lost; two pulses before a poll give one sample; an unbound gesture holds nothing; blur releases a held gesture; a `menu`-context action is not held by a gesture in `play`.
   - **Green:** the gesture sources and the latch. Export from `index.ts` (with `index.test.ts` red first).
5. [x] **`touch-controls.ts`.** Done: red was "Failed to resolve import ./touch-controls"; then 14 passed. FloorFifty's DOM cases (capture, page-gesture cancel, the margin in the DOM) move to step 6, its device-selection case is `Input.device` (M4.1), and its material cases are FloorFifty's look.
   - **Red:** FloorFifty's `touch-controls.test.ts` cases for `nearestTarget`, `StickyPointers` and `PointerLatch`, over string actions. Expect the missing module.
   - **Green:** port them (the `TouchControls` class stays in FloorFifty; Svelte owns mounting here).
6. [ ] **`TouchControls.svelte`.**
   - **Red:** `touch-controls-view.test.ts` (jsdom, Testing Library): a press holds and a release lets go; a second finger on a held button reports nothing; a near miss within 24 px presses the nearest (stubbed rects); a slide moves the hold; `data-held` follows the latch; `shown: false` hides without unmounting (same element) and releases what was held; unmount releases; buttons are `tabindex=-1` with their aria labels.
   - **Red:** `touch.layout.test.ts`: in a fixture, every button is at least 48 px and inside the viewport at every reference size and variant (`checkLayout`).
   - **Green:** the component and its CSS.
7. [ ] **`SwipeSurface.svelte`.**
   - **Red:** `swipe-surface.test.ts`: pointer events reach a stub tracker with `timeStamp`; `steers` decides `options.steers`; a cancel or lost capture lifts only that finger; the indicator draws while steering (`data-steering`) and not after lift.
   - **Green:** the component.
8. [ ] **Game lane.**
   - **Red:** in `keys.test.ts`: a `gestures` payload joins the profile (`gesture` on an equal key payload's action, else a new action); a refused gesture payload throws; `touchMode` defaults; `source.gesture.pulse('flick-down')` reaches exactly one tick's command. In `default-screens.test.ts`: under touch, a map in `swipe` mode shows the swipe surface and no buttons, and a flick through pointer events on it gives a command; in `buttons` mode, the `TouchControls` buttons hold and release as before.
   - **Green:** the options, `InputSource.gesture`, the play screen on both components. The existing touch-button layout contract (`screens.layout.test.ts`) must stay green unchanged.
   - **Emberwick check:** its golden stays unchanged.
9. [ ] **Example, exports, reports and docs.**
   - `examples/core/core-input-touch.ts`: a square steered by swiping, a flick down drops it; the catalog test and the `examples` E2E projects boot it.
   - Regenerate the API reports, cheatsheet, API index and agent skills; add the changeset.
   - Tick the 02 row; record the evidence in 02's execution record and in 03.

## Verification

- Focused unit runs per step, as above.
- `pnpm format`, `pnpm check`, the CI checks-job extras, `pnpm test:parity` (the ui layout project and the game's), `CI=1 pnpm test:e2e`, and `prepare-ruken` for both games.
- **Owner acceptance, never ticked by an agent:** a real phone plays the example and Emberwick with the buttons and the swipe surface (sticky near misses, two thumbs, a flick while steering), with the device, browser and date recorded.
