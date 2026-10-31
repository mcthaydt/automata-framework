# EDK.6b: the WebKit iPad journey harness

**Row:** `docs/02-master-delivery-plan.md` EDK.6b. Lane **editors** (the editor-kit row has no owner; the coordinator
assigned it here on 2026-10-31). Size M. Prerequisite EDK.6a: in effect on `main` (the kit's and editor-2d's `layout`
projects already run Chromium, WebKit and Firefox), though its row is not ticked; the coordinator owns the tick.
**Spec:** [editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.5 (pointer pipeline), §7 (responsive and input
inventory), §8 (the "Tablet journeys" layer), §9 (EK-a, EK-b, EK-c, EK-g, EK-i). Accepted under the Owner's "Auto accept
all spec and plans". It unblocks ED2D.8, ED3D.11 and EDS.10, so its API is written for those lanes.

## Decisions (veto-defaults)

1. **Journeys run in Vitest browser mode, not a second test runner.** The repo already runs Playwright through
   `@vitest/browser-playwright`; a `journeys` project uses its WebKit instance with an iPad context (`hasTouch: true`,
   `deviceScaleFactor: 2`, an iPad Safari user agent) through the provider's `contextOptions`. Each journey sets its
   window with `page.viewport` from the shared profiles. One runner, one install, one way to mount a fixture.
2. **The helpers dispatch `PointerEvent`s in the page** (the row's words): `pointerType` touch, pen or mouse, with
   pressure, tilt and contact size, and a `pointerId` each. Playwright's real touch input exists only in Chromium, and
   Pencil pressure, tilt and a palm's contact size exist nowhere in it, so the kit's own recogniser is fed what an iPad
   sends. What a real iPad does with its own hardware stays the Owner's device pass.
3. **The public surface** (`@mcthaydt/automata-editor-kit/testing`):
   - `IPAD_PROFILES`: iPad 11" landscape 1194×834 and portrait 834×1194, iPad mini 1133×744, iPad 13" 1366×1024, each
     `{ name, width, height }`.
   - `journeyProject(options)`: the Vitest project config both editors spread into their own config (WebKit, iPad
     context, `src/**/*.journey.test.ts`), so a lane adds journeys without copying settings. Each package gets a
     `test:journeys` script.
   - `createPointers(target)`: `tap`, `longPress`, `drag(path)`, `pinch(centre, scale)`, `twist(centre, radians)`,
     `pencilHover(path)`, `pencilStroke(path, { pressure, tilt })`, `palm(at)` (a touch with a large contact),
     `release(id)`. A step waits a frame, so the page sees the gesture as a person makes it, not in one task.
   - `rotate(to)`: swaps the viewport between a profile's landscape and portrait mid-gesture, as EK-c turns the iPad.
4. **A fixture page for the kit** (`testing/JourneyFixture.svelte`): an `EditorShell` with a panel holding a stepper, a
   slider in a scroll region, and a canvas surface with `attachGestures` logging what it recognised, plus a History,
   so each EK case reads its outcome from the page.

## Files

**Create** in `packages/editor-kit/src/testing/`: `ipad-profiles.ts`, `journey-project.ts`, `pointers.ts` (+
`pointers.test.ts` for the event sequences each helper produces, in the unit project with a recording target),
`JourneyFixture.svelte`. In `packages/editor-kit/src/journeys/`: `stepper-scrub.journey.test.ts` (EK-a),
`palm.journey.test.ts` (EK-b), `rotate.journey.test.ts` (EK-c), `layout.journey.test.ts` (EK-g at the four iPad
profiles), `teardown.journey.test.ts` (EK-i).
**Modify:** `packages/editor-kit/src/testing/index.ts` (exports), `packages/editor-kit/vitest.config.ts` (the
`journeys` project), `packages/editor-kit/package.json` (`test:journeys`), `packages/editor-2d/vitest.config.ts` and
`package.json` (the project and the script, with no journeys yet: ED2D.8 adds them), the kit spec §8 (an as-built
note on the harness).
**Interfaces:** consumed by ED2D.8, ED3D.11 and EDS.10. The kit is private, so no changeset.

## Steps

- [x] 1. Plan (this file).
- [x] 2. `pointers.ts`: each helper's event sequence (types, pointer ids, kinds, pressure, contact size, positions)
  against a recording target (unit, failing first).
- [ ] 3. `ipad-profiles.ts` and `journey-project.ts`; the `journeys` project in the kit config and its script; a first
  journey (EK-g at one profile) proves the WebKit iPad context (`navigator.maxTouchPoints > 0`, `devicePixelRatio` 2).
- [ ] 4. `JourneyFixture.svelte`; EK-a (a 40 px drag on the stepper's label is one undo step, by the configured rate;
  undo restores it).
- [ ] 5. EK-b (Pencil down, then a palm: the palm is ignored, the stroke unaffected) and EK-i (teardown mid-gesture:
  capture released, nothing fires after).
- [ ] 6. EK-c (rotate mid-drag of a slider: the drag ends cancelled, the value unchanged, no remount, the panel's scroll
  kept) and EK-g at all four profiles (the layout contract; every action reachable).
- [ ] 7. editor-2d gets the project and script; the kit spec's as-built note; gates: `pnpm format`,
  `TURBO_FORCE=true pnpm check`, the kit's `test:layout` and `test:journeys`, editor-2d `test:parity`.

## Execution log

- 2026-10-31: plan written on `main` at `6a5f03c5`.
- 2026-10-31, step 2: `pointers.test.ts` failed on the missing module, then 7 of 8 passed; the eighth expected a palm
  landing while the Pencil is down to be `isPrimary: false`, but Pointer Events count primaries per pointer type, so the
  first touch is primary; the expectation was wrong and now says so (8 pass).
