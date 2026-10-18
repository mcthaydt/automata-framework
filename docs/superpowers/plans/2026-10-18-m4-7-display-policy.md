# M4.7 Display policy: TDD plan

- **Task:** M4.7 in [02](../../02-master-delivery-plan.md).
  - M4 spec [§4.9](../specs/2026-10-16-m4-input-display-design.md), with §5 (host display change), §6 (fullscreen failure, overlay that cannot fit), §7 (`RotateHint`, `LandscapeGate`, `TouchControls` reduced), §8, and decision M4-D5.
  - Acceptance D-a to D-d.
- **Lanes:** runtime, ui, game. **Depends on:** M4.3 (#80) and M4.6 (#79), both merged.
- **Status:** Drafted 2026-10-18.
- **Progress:** 10 of 11 steps.

## Sources, read at these commits

- **FloorFifty at `ac72660`:**
  - `apps/client/src/ui/fullscreen.ts` (75 lines):
    - `fullscreenSupport`: Home Screen on iOS, `element` where `requestFullscreen` exists;
    - `isFullscreen`, `onFullscreenChange`;
    - `toggleFullscreen`, which asks for a landscape lock and ignores a refusal.
  - `ui/components/LandscapeGate.svelte` (109):
    - a cover over everything, empty while the gate is open;
    - one tap for fullscreen;
    - "turn upright or add to the Home Screen" otherwise;
    - the button focused.
  - `ui/components/RotateHint.svelte` (106) is a dismissible toast in FloorFifty. The M4 spec makes it a hint over a paused game for a game locked to one orientation. AF follows the spec, and takes FloorFifty's words and look.
- **AF on `main` (`7143416`):**
  - `packages/ui/src/browser/landscape-gate.ts`: the `landscapeGate(inputs)` classifier, with no screen yet.
  - `packages/runtime/src/boot/boot-program.ts`:
    - `createPageLayers`, with its `overlay` layer;
    - the geometry owner (`onChange`, `setHostDisplay`);
    - `Hosting.display`.
  - `packages/host`: `Hosting.setFullscreen`. Standalone, the SDK answers `{ fullscreen: false, support: 'none' }` (its `qe` standalone session), so a standalone page asking the host for fullscreen gets nothing.
  - `packages/ui/src/touch/TouchControls.svelte` (M4.3):
    - the buttons sit in the screen frame's action row, inside `visible` and outside the corner row and the host's strip;
    - there is no reduced set yet.
  - `packages/ui/src/slots/ui-slot.ts`: `hud.overlay`, which no screen renders yet.
  - `packages/runtime/src/time/time.manager.ts`: the pause reasons `lifecycle`, `menu` and `input`.

## Scope

**In:**
- standalone fullscreen in `ui`;
- `LandscapeGate` and `RotateHint` in `ui`;
- the runtime's display policy:
  - the gate, standalone only;
  - the rotate hint over a paused game, with the pause reason `display`;
- `GameSpec.orientation`;
- the touch overlay's reduced set (`required`), with `keys()` naming required keys;
- the overlay as an intruder in `checkLayout`;
- the play screen rendering the `hud.overlay` slot;
- the E2E for D-b, D-c and D-d under the fake host.

**Out:**

| What | Where |
|---|---|
| Checking `GameSpec.orientation` against the ship config's `runtime.orientation` | Follow-up row in 02, a `ship prepare` and `automata check` rule like M5.7's board check. Until then the game names its orientation in both. |
| Localized words for the gate and the hint | PRODUCT.L. The words are props; the runtime's are English, like its boot failure copy. |
| A landscape lock outside fullscreen | Browsers refuse it outside an installed app (FloorFifty). It is asked for with fullscreen, and a refusal changes nothing. |

## Contract

### Standalone fullscreen (`packages/ui/src/browser/fullscreen.ts`, create)

```ts
export function fullscreenSupport(doc: Document, nav: Navigator): FullscreenSupport // 'element' | 'ios-home-screen' | 'none'
export function isFullscreen(doc: Document): boolean
export function onFullscreenChange(doc: Document, listener: () => void): () => void
/** Enters element fullscreen and asks for a landscape lock; a refusal of either changes nothing. */
export function enterFullscreen(doc: Document): Promise<void>
```

This is FloorFifty's without the hosted branch. Under Ruken the gate is off (M4-D5), so this is only ever the standalone page asking its own browser. It is never a fallback from a host's refusal.

### `LandscapeGate.svelte` and `RotateHint.svelte` (`packages/ui/src/display/`, create)

- **`LandscapeGate`:**
  - Props: `state: LandscapeGateState`, `copy { title, body, go, uprightTitle, uprightBody }`, `onfullscreen`.
  - A modal over everything, empty at `none`.
  - At `fullscreen`, a primary button that is focused.
  - At `rotate-or-install`, words only.
- **`RotateHint`:**
  - Props: `shown`, `copy { title, body }`.
  - A cover over the paused game, saying to turn the phone. It is not interactive (§7), so there is no focus trap and nothing to press.

### The display policy (`packages/runtime/src/display/display-policy.ts`, create)

```ts
export interface DisplayPolicyOptions {
  readonly orientation: 'portrait' | 'landscape' | 'any'
  readonly hosted: boolean
  readonly win: Window
  readonly geometry: GeometryOwner
  readonly layer: HTMLElement      // the page's overlay layer
  readonly time: Time
  readonly copy?: Partial<DisplayCopy>
}
export function displayPolicy(options: DisplayPolicyOptions): Effect.Effect<void, never, Scope.Scope>
```

- **The gate (standalone only, M4-D5):** follows `landscapeGate` over:
  - the geometry's form factor;
  - `(pointer: coarse)`;
  - `fullscreenSupport`;
  - `isFullscreen`;
  - `(display-mode: standalone), (display-mode: fullscreen)`.

  Its button calls `enterFullscreen`. A refusal leaves the gate as it was, and the game plays in the window (§6).
- **The rotate hint:**
  - `portrait` or `landscape` game on a phone form factor of the other orientation: the hint shows and `Time.pause('display')` is called.
  - Back in the game's orientation: the hint hides and `Time.resume('display')` is called.
  - `any` never shows it.
  - It applies under Ruken too (§7).
- Boot runs it after the first screen. Closing the runtime scope removes every listener and unmounts both.
- `PauseReason` gains `display`.

### `GameSpec.orientation` and `GameDefinition.orientation` (modify; additive)

Default `any`. The same value the ship config writes as `runtime.orientation`.

### The touch overlay's reduced set (`packages/ui/src/touch/`, modify)

- `TouchButtonSpec.required?: boolean`.
- When the buttons cannot all fit their group's box at the primary size, `TouchControls` shows only the required ones and sets `data-reduced`. It never shrinks a target (§4.9, §6).
- `keys()` gains `required?: readonly string[]` (key codes). Their actions are `required` in the profile, so rebinding never leaves them unbound (M4-D4), and they are required in `touchButtons`.

### The overlay as an intruder (`packages/ui/src/testing/layout-contract.ts`, modify)

`checkLayout` treats each visible `[data-touch-overlay] [data-action]` box as reserved for every control outside the overlay. A control under a touch button is reported.

### The HUD layer (`packages/game`, modify)

The default play screen renders the extensions' `hud.overlay` components in its frame's body. That is inside `visible`, above the canvas and below dialogs. `ScreensGame.extensions` (M4.4) carries them.

## Steps

Each step starts with its test, run red, with the failure reason recorded. The pre-commit hook runs the affected tests, so each red test is committed with its fix.

- [x] **1. This plan,** plus the 02 follow-up row (orientation consistency). *Verify:* `pnpm format`.
- [x] **2. Standalone fullscreen** (`ui/src/browser/fullscreen.test.ts`).
  - *Red:*
    - support is `element` with `requestFullscreen`, `ios-home-screen` on an iPhone in Safari, and `none` from the Home Screen or without the API;
    - `isFullscreen` and `onFullscreenChange` follow the document;
    - `enterFullscreen` requests it and a landscape lock, and swallows a refusal of either.
  - *Done: red `Failed to resolve import "./fullscreen"`, then 6 of 6 green. `enterFullscreen` takes the `Screen` as a parameter, so the lock is testable.*
- [x] **3. `LandscapeGate`** (`ui/src/display/landscape-gate.svelte.test.ts`).
  - *Red:*
    - nothing at `none`;
    - at `fullscreen`, a modal dialog with its title, and the primary button focused, which calls `onfullscreen`;
    - at `rotate-or-install`, words and no button.
- [x] **4. `RotateHint`** (`ui/src/display/rotate-hint.svelte.test.ts`).
  - *Red:* hidden or shown by `shown`, with its words, and nothing focusable.
  - *Layout:* both covers (`DisplayFixture.svelte`, `display.layout.test.ts`) at every reference size and variant. The gate's button is reachable and whole.
  - *Done (steps 3 and 4):*
    - Red `Failed to resolve import` for both components, then 5 of 5 DOM cases.
    - Layout: 225 of 225, three shows at 25 sizes in three engines.
    - Three reds before that, all fixed:
      - The cover hid the screen's Back while leaving it reachable. The gate now holds the page as a modal does (`holdModal`): the page behind is inert, and focus starts on its button. The hint inerts the page behind it (`inertOutside`).
      - With the keyboard up, the covers reached under it. They now end above it (`--af-visual-inset-bottom`), and the gate's panel is a declared scroll region. As in every other contract, nothing is essential with the keyboard up.
      - `bind:this` sets null, not undefined, when a cover goes. The effects check for both.
    - Exported from the ui root.
- [x] **5. `PauseReason` `display`** (`time.test.ts`).
  - *Red:* pausing and resuming for `display` alone, beside `menu`.
  - *Done: red in typecheck (TS2345, `"display"` is not a `PauseReason`), then green; `src/time` 9 of 9.*
- [x] **6. The display policy** (`runtime/src/display/display-policy.test.ts`, jsdom, with a fake geometry owner and `matchMedia`).
  - *Red, by case:*
    - **D-d:**
      - hosted, the gate never shows, whatever the inputs;
      - standalone, coarse, `phone-landscape`, support `element` and not fullscreen: the gate shows `fullscreen`;
      - its button enters fullscreen, and the gate goes away on `fullscreenchange`;
    - a refused fullscreen leaves the gate up;
    - a `portrait` game at `phone-landscape` shows the hint and pauses for `display`; back to `phone-portrait`, it hides and resumes;
    - an `any` game never shows the hint;
    - closing the scope unmounts both and removes the listeners.
  - *Done:*
    - Red `Failed to resolve import "./display-policy.svelte.js"`, then 9 of 10. The tenth was a test bug: its presentation bus needs a scope. Then 10 of 10, and typecheck clean.
    - The file is `display-policy.svelte.ts`, so the covers' props can be `$state`.
    - Two additions to the plan:
      - The rotate hint, like the gate, needs a coarse pointer: a short desktop window is `phone-landscape` too, and has nothing to turn.
      - English words are `DISPLAY_COPY_EN`.
- [x] **7. Boot runs it** (`boot.test.ts`; `game-definition.ts`, `boot-program.ts`; `define-game.ts`).
  - *Red:*
    - a `portrait` game booted at a landscape phone size shows the hint;
    - `defineGame` passes `orientation` through, default `any`.
  - *Done:*
    - Red on both (no hint, then `orientation` undefined), then green: boot 17 of 17, `define-game.test.ts` 25 of 25.
    - jsdom has no `matchMedia`, so the policy treats a window without it as a fine pointer, not installed, as `Input` does.
    - The runtime's root exports the `GameOrientation` and `DisplayCopy` types.
- [x] **8. The reduced touch set** (`touch-controls-view.svelte.test.ts`, `touch.layout.test.ts`; `keys.test.ts`).
  - *Red:*
    - with too little room, only the required buttons show, still at the primary size, with `data-reduced`;
    - with room, all show;
    - `keys(…, { required: ['Space'] })` marks Space's action required in the profile and in `touchButtons`.
  - *Layout (D-a):* at 780×270, a fixture with an ActionBar above the touch controls. Every touch button is at least 48 px, and none covers an ActionBar control.
  - *Done:*
    - Red: `shownButtons` missing (3 cases), and `keys()`'s two new cases. Then green: ui touch unit 32 of 32, ui touch layout 153 of 153, game unit 117 of 117, game layout 300 of 300.
    - **Finding (D-a red in every engine and size):** the touch group's invisible sticky margin (24 px, FloorFifty's) reached above the buttons, over the ActionBar, so the bar's lower edge hit-tested as the touch group. The margin now reaches sideways and down, never up.
    - **Measured:** at 780×270 one row holds all four fixture buttons, so nothing is dropped there and D-a holds with all four. The reduction is tested at 360×640, where only the three required show, at the primary size.
    - The play screen passes `required` from the input map. `TouchButton.required` is optional, set only when true, so the existing shapes stay.
- [x] **9. The overlay as an intruder** (`layout-contract.layout.test.ts`).
  - *Done: red (the planted control under a touch button not reported), then green. The whole ui layout project passed, 1584 of 1584, with the check in `checkLayout`. It is `findTouchIntrusions` in `layout-contract.ts`, not a change to the shared `findIntrusions`: the overlay's boxes are the intruders, and the touch buttons are exempt from their own check.*
- [x] **10. The HUD layer** (`default-screens.test.ts`).
  - *Red:* an extension's `hud.overlay` component renders on play, inside the frame, and is gone on paused.
  - *Done: the first version of the test passed with no code, because `hud()?.closest(…)` is undefined and passes `not.toBeNull()`. The test now asserts the component exists first, and was red (null), then green; game unit 118 of 118. `ScreensGame.extensions` is added here too, the same field M4.4's branch adds (#87); whichever merges second resolves the one-line conflict.*
- [ ] **11. E2E, exports, reports, gates and records.**
  - *E2E (fake host, `core-input-touch`), new `examples/e2e/display-policy.e2e.ts`:*
    - **D-b:** the host moves `hostReserved` from right to left mid-play. The touch buttons move with it, and the screen instance is the same (a marker set on it survives).
    - **D-c:** a simulated visual-viewport inset keeps `data-form-factor` and the screen instance.
    - **D-d:** under the fake host at 844×390 with a coarse pointer, no gate.
  - *Regenerate,* in order: `pnpm build`, `pnpm api-report --update`, `pnpm cheatsheet`, `pnpm api-index`, `pnpm agent-skills --write`.
  - *Changeset.*
  - *Gates:* `pnpm format`, `pnpm check`, CI extras, `pnpm test:parity`, `CI=1 pnpm test:e2e`, prepare-ruken.
  - *Records:* tick 02, add an execution row, update 03.

## Verification

Run the full local gates before the PR is opened. No existing golden may change.

**Owner acceptance:** none of its own. The gate and hint on a real phone are part of M4.10's device gates.
