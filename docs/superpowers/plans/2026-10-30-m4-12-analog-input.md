# M4.12 Analog play input for 3D: TDD plan

- **Task:** M4.12 in [02](../../02-master-delivery-plan.md) ("Analog play input for 3D: touch stick, camera drag, right-stick axis", a core change request from M3). Spec: the M4 spec's [§16 amendment](../specs/2026-10-16-m4-input-display-design.md#16-amendment-2026-10-30-analog-play-input-for-3d-m412), from M3 spec §4.2 and §7. Acceptance A-a to A-r.
- **Lanes:** runtime and ui. **Depends on:** M4.3 and M4.7 (merged). **Consumers:** GAME-3D.1h and M3.7b (`games/base-3d`).
- **Status:** Drafted 2026-10-30. Spec amendment pending Owner review; the new public API needs the Owner's review.
- **Progress:** 0 of 9 steps.

## Sources, read at these commits

- **The Last Light `src/input.ts` and `tests/input.test.ts` at `92e6704`** (`/home/user/pixijs3d_experiment_001`): `STICK_RADIUS` 48, `STICK_DEAD` 0.25, `stickVector(dx, dy)` (zero inside the dead zone, clamped to length 1, axes `x`/`z`); the floating stick: the origin is where the thumb lands in the `[data-stick]` zone, one pointer, captured, other fingers ignored, released on up, cancel and blur. AF ports `stickVector` without the dead zone (runtime owns it, M4-D13) and names the second axis `y` (positive down, as a pad's axes).
- **AF `main` at `6aee63b`:** `Input` in `packages/runtime/src/input/input.manager.ts` (576 lines, so the analog state goes in its own file to stay under the 600-line ceiling); `quantizeStick` and `DEADZONE` in `gamepad/read-pad.ts`; `SwipeTracker`; `TouchControls.svelte` and `SwipeSurface.svelte` in `packages/ui/src/touch/`; `CORE_SETTINGS` in `packages/runtime/src/settings/core-settings.ts`.

## Interfaces

Consumed: `Input` (§4.2), `quantizeStick`, `DEADZONE`, `actionsForGesture`, `CORE_SETTINGS`, `TouchControls`, the geometry CSS variables (`--af-host-reserved-*`, `--af-visual-inset-bottom`, `--af-target-primary`).

Produced (spec §16.3): `GestureName` + `'camera-drag'`; `CameraDragTracker`, `DragSink`, `DragPointer`, `DragStart`; `Input.touchStick`, `Input.drag`, `Input.cameraDrag()`, `TouchStickSink`; `turnUnitsFromPixels`, `TURN_UNITS_PER_TURN`, `MAX_TURN_UNITS_PER_STEP`; `CameraSettings`, `cameraSettingsSchema`, `CAMERA_SETTINGS_DEFAULT`, `CAMERA_TURN_SPEED`, `CoreSettings.camera`; ui `TouchControlsProps.stick`/`onstick`/`onstickend`, `stickVector`, `TOUCH_STICK_RADIUS_PX`, `CameraDragSurface`, `CameraDragSurfaceProps`, `DragTracker`.

## Files

| Action     | File                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Modify     | `packages/runtime/src/input/input-profile.schema.ts` (`camera-drag`; `touchModesFor` ignores it) and `input-profile.test.ts` |
| Create     | `packages/runtime/src/input/gestures/camera-drag-tracker.ts`, `camera-drag-tracker.test.ts`                                  |
| Create     | `packages/runtime/src/input/analog/camera-turn.ts`, `camera-turn.test.ts`                                                    |
| Create     | `packages/runtime/src/input/analog/camera-settings.schema.ts`, `camera-settings.test.ts`                                     |
| Create     | `packages/runtime/src/input/analog/analog-input.ts` (touch stick and drag sum, used by the manager)                          |
| Modify     | `packages/runtime/src/input/gamepad/read-pad.ts` (extract `stickDirections`, used by `readPad` and the touch stick)          |
| Modify     | `packages/runtime/src/input/input.manager.ts`; create `packages/runtime/src/input/input-analog.test.ts`                      |
| Modify     | `packages/runtime/src/settings/core-settings.ts`, `core-settings.test.ts`                                                    |
| Modify     | `packages/runtime/src/index.ts` (exports)                                                                                    |
| Create     | `packages/ui/src/touch/touch-stick.ts`, `touch-stick.test.ts`, `TouchStick.svelte`, `touch-stick-view.svelte.test.ts`        |
| Modify     | `packages/ui/src/touch/TouchControls.svelte`, `touch-button.ts`                                                              |
| Create     | `packages/ui/src/touch/CameraDragSurface.svelte`, `camera-drag-surface.ts`, `camera-drag-surface.svelte.test.ts`             |
| Modify     | `packages/ui/src/testing/TouchFixture.svelte`, `packages/ui/src/touch/touch.layout.test.ts`, `packages/ui/src/index.ts`      |
| Create     | `.changeset/m4-12-analog-input.md` (patch: runtime, ui)                                                                      |
| Regenerate | API reports, API index, cheatsheet if stale, agent skills                                                                    |

## Steps

Each step: write the test, run it and see it fail for the stated reason, make the minimal change, run it green.

- [ ] **1. `camera-drag` in the profile (A-k).** Test in `input-profile.test.ts`: a profile binding `camera-turn: { gesture: ['camera-drag'] }` parses; `touchModesFor` of it with a touch button is `['buttons']`, without one `[]`. Fails: the enum rejects `camera-drag`. Change: add it to `GESTURE_NAMES`; `touchModesFor` counts only swipe-tracker gestures. Command: `pnpm --filter @mcthaydt/automata-runtime exec vitest run src/input/input-profile.test.ts`.
- [ ] **2. `CameraDragTracker` (A-a, A-b, A-c, A-g).** Tests feed samples to a recording sink. Fails: module missing. Command: `… vitest run src/input/gestures/camera-drag-tracker.test.ts`.
- [ ] **3. `turnUnitsFromPixels` (A-f, A-m).** Fails: module missing. Command: `… vitest run src/input/analog/camera-turn.test.ts`.
- [ ] **4. Camera settings (A-l).** `camera-settings.test.ts` for the schema; `core-settings.test.ts` for `CORE_SETTINGS` reading a record without `camera`. Fails: module missing, then `camera` absent. Command: `… vitest run src/input/analog src/settings/core-settings.test.ts`.
- [ ] **5. `Input.touchStick`, `Input.drag`, `cameraDrag()` (A-d, A-e, A-h, A-i, A-j).** `input-analog.test.ts` over `makeInput` with a fake pad. Fails: properties missing. Change: `analog/analog-input.ts`, `stickDirections` extracted from `readPad` (its tests stay green), the manager wired. Command: `… vitest run src/input`.
- [ ] **6. ui `stickVector` and the stick in `TouchControls` (A-n).** Unit test ported from The Last Light; DOM test drives pointer events on `[data-touch-stick]`. Fails: module missing, then no stick zone. Command: `pnpm --filter @mcthaydt/automata-ui exec vitest run --project unit src/touch`.
- [ ] **7. `CameraDragSurface` (A-o, A-p).** DOM test with a recording tracker. Fails: component missing. Same command.
- [ ] **8. Layout (A-q, A-r).** `TouchFixture` gains `show: 'stick'` (stick, two end buttons, the drag surface) and `'stick-with-bar'`; `touch.layout.test.ts` checks the stick's size, `checkLayout`, and that no point of a reserved strip hits the surface. Fails: the fixture has no stick. Command: `pnpm --filter @mcthaydt/automata-ui exec vitest run --project layout src/touch` (Chromium, WebKit, Firefox).
- [ ] **9. Exports and gates.** `index.ts` exports in runtime and ui (the index tests list them); changeset; `pnpm format`; `pnpm build`; `pnpm api-report --update`; `pnpm api-index` (and `pnpm cheatsheet` if stale); `pnpm agent-skills --write`; `pnpm changeset status --since=origin/main`; `node tooling/release/src/check-changesets.ts`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-runtime test:parity` and `pnpm --filter @mcthaydt/automata-ui test:parity`; the focused Emberwick touch e2e spec (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local`).

## Gates

| Gate                                                          | Where                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| Focused unit and DOM                                          | each step                                              |
| Layout, three engines                                         | step 8, and ui `test:parity`                           |
| `pnpm check` (lint, typecheck, boundaries, style, knip, unit) | step 9                                                 |
| API report, API index, agent skills, changesets               | step 9                                                 |
| runtime parity                                                | step 9 (no sim change; proves the replay goldens hold) |
| Emberwick touch e2e (focused)                                 | step 9 (the overlay changed)                           |
| Hosted CI, GPU runner, Owner device acceptance                | pending, after the PR                                  |

## Execution log

- 2026-10-30: plan and spec amendment drafted.
