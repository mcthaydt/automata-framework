# M4.4 Rebinding, prompts, the Controls and Display sections, and the core Settings screen: TDD plan

- **Task:** M4.4 in [02](../../02-master-delivery-plan.md).
  - M4 spec [§4.5, §4.6 and §4.8 Settings](../specs/2026-10-16-m4-input-display-design.md).
  - Also §5 (the rebind flow), §6 (failures), §7 (the Controls, Display and `SettingsScreen` rows) and decisions M4-D3, M4-D4 and M4-D8.
  - Acceptance I-h, I-i, I-k and I-l.
  - Example: `core/core-input-rebind.ts`.
- **Lanes:** runtime, ui and game. **Depends on:** M4.1 (#74), M4.6 (#79) and M4.5 (#77), all merged.
- **Status:** Implemented and locally verified 2026-10-18; CI and review pending.
- **Progress:** 13 of 13 steps.

## Sources, read at these commits

- **AF on `main` (`7143416`):**
  - `packages/runtime/src/input/input.manager.ts`: `makeInput({ target, profile, bus })`. It builds its key, pad and stick tables from the profile once and never changes them.
  - `packages/runtime/src/input/input-profile.schema.ts`: `InputBinding` (with `required` and `context`), `RESERVED_KEYS` and `RESERVED_PAD_BUTTONS`.
  - `menu-actions.ts`: Escape and pad B are `back`, and pad 9 and Escape are `pause`.
  - `packages/runtime/src/settings/`:
    - `makeSettings`: memory first, then a forked `Hosting.saves.set`, with a warning on refusal and no device-storage fallback;
    - `readSettings`, which falls back per record;
    - `displaySettingsSchema`, the field `display.quality`.
  - `packages/game/src/screens/default-screens.ts`: title, play and paused. Each builds its own `Input`, and a menu screen drives a `FocusNavigator` through `menuInput`.
  - `packages/game/src/default-content.ts`: the default flow, `title → play ⇄ paused → title`.
  - `packages/runtime/src/flow/flow.manager.ts`:
    - restores focus by name when a screen is returned to (F-b, M4.5);
    - a transition to a screen with no `ScreenDef` does nothing, so a game with its own screens is not affected by a new default screen.
  - `packages/game/src/input/keys.ts`: one action per payload, ids `<command>-<n>`, and the `InputMap.profile`.
  - `packages/render-pixi/src/renderer.ts`: `PixiStage.setQuality(tier)` (M4.9).
  - `packages/ui`: `ScreenFrame`, `ScrollList`, `CornerControls`, `OptionGroup`, `Button` and the layout contracts (M4.6).
  - `packages/ui/src/slots/ui-slot.ts`: `settings.sections`, which no screen renders yet.
- **FloorFifty at `ac72660`:**
  - `apps/client/src/ui/glyphs.ts` (48 lines): the glyph families and the printed labels (`A`/`B`, `✕`/`○`). A button known by a word is a message, so it follows the language.
  - FloorFifty has no rebinding. The capture, conflict and override logic is AF's own, from the spec's rules.
- **Ruken SDK (vendored):** `SAVE_KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/`, so the key `settings` is a valid save key.

## Scope

**In:**
- the saved input settings (`input: { profile, overrides, touchMode }`);
- applying overrides, and dropping bad ones;
- the pure rebind (reserved, conflict, required);
- `Input.rebind`, `resetBindings` and `capture`, with the profile live in the Input;
- `input.bindings.changed`;
- core settings for a game that declares none;
- device prompts;
- the Controls section, the Display section and `SettingsScreen`;
- the default Settings screen reached from paused, rendering the `settings.sections` slot;
- the Display section applying the quality tier;
- `keys()` action labels;
- the example, its golden, and the E2E for I-h and I-i.

**Out:**

| What | Where |
|---|---|
| Rebinding `pause`, the one rebindable menu action (§4.1) | Follow-up row in 02. Menu bindings are a fixed table in `menu-actions.ts`. Making one entry an override needs the menu table to read the settings too, which is a change of its own. Until then Escape and Start pause. |
| The `ui/ui-*.ts` one-file examples | Their own follow-up row (from M4.6). The Settings screen's slot, added here, is the route they need. They land after this PR. |
| A "save refused" state in the Controls section (§7) | `SettingsStore.update` forks the write and only logs a refusal (M1.5). The section cannot know. The bindings hold for the session, as §4.5 says. Follow-up row in 02. |
| Settings from the title screen | The flow returns from Settings by `back` to one screen, paused. A title entry needs a second route. |
| Localized words | PRODUCT.L. The default screens' words stay English, like the rest of them. Every word in the new ui components is a prop. |

## Contract

### Saved bindings (`packages/runtime/src/input/bindings/input-settings.schema.ts`, create)

```ts
export interface BindingOverride { readonly keys?: readonly string[]; readonly pad?: readonly number[] }
export interface InputSettings {
  readonly profile: string                                   // the profile id the overrides were made against
  readonly overrides: Readonly<Record<string, BindingOverride>>
  readonly touchMode?: TouchMode | undefined
}
export const INPUT_SETTINGS_DEFAULT: InputSettings          // { profile: '', overrides: {} }
export const inputSettingsSchema: z.ZodType<InputSettings, unknown> // a bad record reads as the default
```

Only keys and pad buttons are rebound. Touch buttons and gestures stay the game's, and touch mode is its own setting.

### Applying and rebinding (`packages/runtime/src/input/bindings/rebind.ts`, create; pure)

```ts
export type Capture = { readonly code: string } | { readonly button: number }
export class RebindConflict  // { action, with }: refused, `with` would be left unbound
export class RebindReserved  // { action, input }: Escape, Tab, pad 8 or 16
export class RebindUnknown   // { action }
export type RebindError = RebindConflict | RebindReserved | RebindUnknown
export function applyOverrides(defaults: InputProfile, saved: InputSettings): { profile: InputProfile; dropped: string[] }
export function rebindProfile(defaults: InputProfile, current: InputProfile, action: string,
  device: 'keyboard' | 'gamepad', capture: Capture): Either<InputSettings['overrides'], RebindError>
```

**`applyOverrides`:**
- An override is dropped, and named in `dropped`, when its action is unknown, when it binds a reserved input, or when it has a pad button out of range.
- Overrides saved against another profile id are all dropped.

**`rebindProfile` (M4-D4):**
1. The action's inputs on that device become the captured one.
2. The captured input leaves every other action live in an overlapping context (the same context, or `any`).
3. If that would leave a `required` action with no input on that device, it returns `RebindConflict { action, with }` and nothing changes.
4. The result is stored as overrides: only what differs from the defaults.

### `Input` (`input.manager.ts`, modify; additive)

```ts
export const REBIND_TIMEOUT_MS = 10_000
export class RebindCancelled, RebindTimedOut
interface Input {
  rebind(action: string, device: 'keyboard' | 'gamepad', capture: Capture): Effect.Effect<void, RebindError>
  readonly resetBindings: Effect.Effect<void>
  /** The next key or pad button. Escape or pad B cancels; nothing for 10 s on Effect's Clock times out. */
  capture(device: 'keyboard' | 'gamepad'): Effect.Effect<Capture, RebindCancelled | RebindTimedOut>
}
interface InputOptions { /* … */ readonly settings?: SettingsStore<unknown> | undefined }
```

- **Profile follows the settings.** With `settings`, the profile is the defaults with the saved `input` overrides applied, and every later change to `input` (from this Input or another) applies at once.
  - The key, pad and stick tables are rebuilt, and everything held is released.
  - `profile` is updated, and `input.bindings.changed { action? }` is published.
- **Without `settings`,** a rebind lasts for this Input only.
- **Capture while open.** A keydown is taken in the capture phase and goes no further, so the Escape that cancels a capture does not also leave the screen. A pad button counts from its press, so a button held when the capture started (the confirm that opened it) is never captured.
- §4.2 gives `rebind` the device and the capture separately. `Capture` says which it is.

### Core settings (`packages/runtime/src/settings/core-settings.ts`, create)

```ts
export interface CoreSettings { readonly input: InputSettings; readonly display: DisplaySettings }
export const CORE_SETTINGS: SettingsDef<CoreSettings> // key 'settings', version 1
```

`defineGame` uses `CORE_SETTINGS` when the game declares no `settings`. A game with its own settings keeps `input` and `display` only when its schema has those fields (`inputSettingsSchema` and `displaySettingsSchema`). The doc comment and the cheatsheet say so.

### Prompts (`packages/ui/src/prompts/`, create)

```ts
export interface PromptBinding { readonly keys: readonly string[]; readonly pad: readonly number[]; readonly touch: boolean }
export type PromptView = { kind: 'key' | 'pad' | 'touch' | 'unbound'; label: string }
export interface PromptCopy { unbound: string; touch: string; pad: GenericPadWords /* bottom, right, left, top, bumpers, triggers, select, start, sticks */ }
export function keyLabel(code: string, layout?: ReadonlyMap<string, string>): string  // layout map, else `KeyK` → `K`
export function padLabel(button: number, glyphs: GlyphFamily, copy: PromptCopy): string // printed per family, words for generic
export function promptView(binding, device, glyphs, copy, layout?): PromptView
export function readKeyboardLayout(nav: Navigator): Promise<ReadonlyMap<string, string> | undefined>
```

- `Prompt.svelte` (`binding`, `device`, `glyphs`, `copy`, `layout?`) renders `[data-prompt=<kind>]`. It is not focusable.
- The labels follow its props. The screen that shows it passes the Input's live device and profile.
- §4.6 writes `<Prompt action="jump" />`. `ui` cannot import runtime's `Input` (runtime depends on `ui`), so the prompt takes the binding and the device as props.

### Settings sections (`packages/ui/src/settings/`, create)

- **`ControlsSection.svelte`:**
  - One row per action: its label, and a button per device showing the `Prompt` for its binding. Every row is 44 px.
  - Pad buttons only when `devices` includes `gamepad`, meaning a pad has connected.
  - A touch mode `OptionGroup` when the profile offers both modes.
  - A Reset button.
  - States are `list`, `capturing { action, device, secondsLeft }`, `conflict { action, with }`, `reserved`, `timed-out` and `saved`. Each has a `role="status"` message from `copy`.
- **`DisplaySection.svelte`:** the quality `OptionGroup` (`high`, `medium`, `low`) and reduced motion as the browser reports it, read-only.
- **`SettingsScreen.svelte`:**
  - `ScreenFrame` and `ScrollList` over the sections (a `sections` snippet).
  - A title, and Back in `CornerControls`.

### Default Settings screen (`packages/game`, modify)

- **Flow:** the default flow gains `settings`, with `paused --settings--> settings` and `settings --back--> paused`. Paused gains a Settings button.
- **The screen:**
  - It shows Controls (when the game has an input map), Display, and every component in the extensions' `settings.sections` slot, in extension order.
  - Its menu Input has the settings store, so a rebind saves and the next play session's Input reads it.
  - Back, Escape and pad B return to paused. During a capture, Escape and B cancel it instead.
- **Quality:** the Display section's choice writes `display.quality` and calls the stage's `setQuality`. The stage starts at the saved tier (`defineGame` keeps the Pixi stage from its renderer setup).
- **Labels:** `keys()` gains `labels?: Record<code, string>`. An action takes the label of its first default key that has one. Otherwise its label is the command id and its payload (`move x -1`).

## Steps

Each step starts with its test, run red, with the failure reason recorded. The pre-commit hook runs the affected tests, so each red test is committed with its fix.

- [x] **1. This plan,** plus the 02 follow-up rows: `pause` rebinding and the Controls section's save-refused state. *Verify:* `pnpm format`.
- [x] **2. Saved input settings and `applyOverrides`** (`bindings/input-settings.test.ts`; `input-settings.schema.ts`, `rebind.ts`).
  - *Red:*
    - a valid record parses;
    - a malformed one reads as the default;
    - an override for an unknown action, a reserved key (Escape), pad 8 or pad 17 is dropped and named, and the rest apply;
    - overrides saved against another profile id are all dropped.
  - *Done: red `Failed to resolve import "./input-settings.schema.js"`, then 7 of 7 green. The schema's fallback is a fresh default object, which Zod's readonly typing needs.*
- [x] **3. `rebindProfile`** (`bindings/rebind.test.ts`).
  - *Red:*
    - jump to `KeyK` replaces jump's keys and keeps its pad;
    - **I-i:** `KeyK`, already fire's, moves to jump, and fire is left with no keys;
    - **I-l:** the same with fire `required` is `RebindConflict { action: 'jump', with: 'fire' }`;
    - a menu-only action keeps a key a play action takes;
    - Tab and pad 16 are `RebindReserved`;
    - an unknown action is `RebindUnknown`;
    - overrides hold only what differs, and binding the default again leaves none.
  - *Done: 8 red (`rebindProfile is not a function`), then green, 15 of 15 in `bindings/`. The errors are `Data.TaggedError` classes through `boot-error.ts`'s `TaggedErrorClass`, as isolated declarations need.*
- [x] **4. The Input's live profile, `rebind` and `resetBindings`** (`input.test.ts`).
  - *Red:*
    - with a store holding an override, `KeyK` holds jump;
    - `rebind` writes the store's `input`, publishes `input.bindings.changed` and updates `profile`;
    - a second Input on the same store follows the change;
    - `resetBindings` empties the overrides;
    - a rebind releases what was held;
    - without a store, a rebind lasts for that Input.
  - *Done: 7 red in `input-rebind.test.ts` (`rebind` missing, the store ignored), then green; `src/input` 108 of 108. The key, pad and stick tables are rebuilt by `tablesFor` on each change. A saved override that is dropped logs a warning when the Input starts. A refused rebind (I-l) also fails the Effect and writes nothing.*
- [x] **5. `capture`** (`input-capture.test.ts`, with `TestClock`).
  - *Red:*
    - the next keydown is the capture, and it reaches no other listener;
    - **I-k:**
      - Escape is `RebindCancelled`;
      - pad B is `RebindCancelled`;
      - 10 s of nothing is `RebindTimedOut`, and the profile is unchanged;
    - a pad button held from before the capture is not captured;
    - its next press is.
  - *Done: 5 red (`capture` missing), then 4 hung and the timeout case failed. The forked capture had not started when the test pressed a key, because one `yieldNow` is not enough with `timeoutFail`'s race. The hung tests also left their capture listener on `window`, which swallowed the later test's key. The tests now wait with `TestClock.adjust(0)`, which runs every fiber until it suspends. The pad B case polls once before the capture, as the menu does every frame: a pad first seen during a capture counts as already held. `RebindCancelled` and `RebindTimedOut` carry the `device` they waited for. `src/input` 113 of 113.*
- [x] **6. Core settings** (`settings/core-settings.test.ts`; `define-game.test.ts`).
  - *Red:*
    - `CORE_SETTINGS` reads its defaults from nothing and keeps a saved `input` and `display`;
    - `defineGame` without `settings` has `CORE_SETTINGS`, and with them keeps the game's.
  - *Done:*
    - Red `Failed to resolve import "./core-settings.js"` and two `defineGame` cases, then green: core settings 3 of 3, `define-game.test.ts` 25 of 25, game unit 115 of 115.
    - **Deviation:** `defineGame` also asks the host for `saves` when it supplies the core settings, as it asks for `leaderboards` with scores. The SDK writes saves through to the host only with that grant; without it, a rebind would not survive a reload. The test of the default `wants` changed from `[]` to `['saves']`.
    - Checked in the vendored SDK: `saves.get` reads the SDK's local copy, so the extra boot read cannot fail offline.
    - The runtime's root entry exports the binding and settings names.
- [x] **7. Prompts** (`packages/ui/src/prompts/prompt-label.test.ts`, `prompt.test.ts`).
  - *Red:*
    - `KeyK` is `K`, `Digit1` is `1`, and `ArrowLeft` is `←`;
    - a layout map's label wins;
    - pad 0 is `A` (xbox), `✕` (playstation) and the bottom-button word (generic);
    - the touch device shows the touch label;
    - no input on the active device is `unbound`;
    - the component follows new props without remounting, and is not in the focus order.
  - *Done: red `Failed to resolve import "./prompt-label"` and `"./Prompt.svelte"`, then 11 of 11 green; svelte-check clean. The test file is `prompt.svelte.test.ts`, so its props can be `$state`. The 16 standard buttons' printed labels per family are AF's, extended from FloorFifty's six actions; Select, Start and Home are words on every family. Exported from the ui root.*
- [x] **8. `ControlsSection`** (`settings/controls-section.test.ts`; a layout contract in `settings.layout.test.ts`).
  - *Red:*
    - one row per action, with a button per device and the prompt;
    - no pad buttons without `gamepad`;
    - activating a button calls `onRebind(action, device)`;
    - each state's message is a polite status;
    - Reset calls `onReset`;
    - touch mode shows only with both modes.
  - *Layout:* rows and buttons at least 44 px at every reference size and variant.
  - *Done: red `Failed to resolve import "./ControlsSection.svelte"`, then one case red (the Reset hook sat on a wrapper, not the button; it now uses the Button's `testId`); 6 of 6 green, svelte-check clean. **Deviation:** the layout contract runs in step 9, over the Settings screen fixture that holds both sections, rather than a second fixture.*
- [x] **9. `DisplaySection` and `SettingsScreen`** (`display-section.test.ts`, `settings-screen.test.ts`; the layout contract).
  - *Red:*
    - the quality options, and `onQuality` when one is chosen;
    - reduced motion is shown, read-only;
    - the screen shows its sections in a scroll list, its title and a Back control that calls `onBack`.
  - *Layout:* no essential below the fold at 780×270, and Back reachable.
  - *Done:*
    - Red `Failed to resolve import` for both components, then 10 of 10 DOM cases green in `src/settings`.
    - Layout (`settings.layout.test.ts`, `SettingsFixture.svelte`, the Controls section included): 150 of 150, two shows at 25 sizes in Chromium, WebKit and Firefox.
    - Two reds before that:
      - The capture message pushed the waiting button below the fold at 780×270 at TV scale. The section now scrolls that button into view while a capture waits.
      - Svelte refused the Controls section's `state` prop next to the `$state` rune (`store_rune_conflict`). It is read as `current` inside.
    - The sections are rows of one `ScrollList` (`minRows` 1).
- [x] **10. `keys()` labels** (`keys.test.ts`).
  - *Red:*
    - `labels: { Space: 'Jump' }` names the action;
    - an unlabelled action is named by its command and payload;
    - `InputMap` gains `labels`.
  - *Done: 2 red (`labels` undefined), then green, 32 of 32 in `keys.test.ts`.*
- [x] **11. The default Settings screen** (`default-screens.test.ts`, `default-content.test.ts`, `screens.layout.test.ts`).
  - *Red:*
    - the default flow has `settings`;
    - paused's Settings opens it;
    - Back returns to paused with focus on Settings (F-b);
    - Controls lists the map's actions;
    - a rebind under `runtime-test` writes `Hosting.saves` (`settings`);
    - Escape during a capture cancels it and stays on Settings;
    - a conflict shows both names;
    - Display's choice calls the stage's `setQuality` and is saved;
    - a `settings.sections` slot component renders;
    - without an input map, there is no Controls section.
  - *Done:*
    - 8 red (no Settings screen), then green: game unit 125 of 125, layout 300 of 300 (paused's essentials now include Settings), browsers 6 of 6.
    - `screen-kit.ts` holds the helpers the default screens share, moved out of `default-screens.ts`. `driveMenu` takes the screen's own Input.
    - The screen's logic is `settings-screen.svelte.ts`, so its view state can be `$state`. The rebind countdown ticks on Effect's clock.
    - Play's Input now takes the settings store, and play reads the saved touch mode. The title applies the saved quality.
    - The default content's pinned hash moved, by design, from `9836a6c32ad89a1a` to `083dacc3c34d55d9`. No golden holds it.
    - The M4.5 test that steps the pad from Resume to Quit is unchanged.
  - *Deviations:*
    - Settings is a gear `IconButton` (named "Settings") at the end of paused's corner row, not a third action. With three actions, the bar ran Quit off the edge at 360–390 px wide, under Ruken's strip, and at TV scale.
    - `SettingsScreen.sections` takes `{ snippet }` or `{ component }` (`SettingsSection`), so an extension's slot component renders as a section. A snippet array cannot hold a component.
    - The test focuses Settings before clicking it, as a real click or key press does (jsdom's `click()` does not); the flow remembers focus by `data-testid` (F-b).
    - No conflict case here: `keys()` cannot mark an action `required`. The runtime (`input-rebind.test.ts`) and the section (`controls-section.svelte.test.ts`) cover I-l.
- [x] **12. The example** (`examples/core/core-input-rebind.ts`, its golden, `examples/e2e/core-input-rebind.e2e.ts`).
  - *Red:* the golden is missing. Record it in Node with `AUTOMATA_UPDATE_GOLDENS=1`, as a new file.
  - *E2E, fake host:*
    - **I-h:** pause, Settings, jump's keyboard button, press `K`; the saved state shows. Reload the game frame, and the row's prompt shows `K` with `K` jumping in play.
    - **I-i:** rebinding fire's key to jump's key leaves fire "Unbound".
  - *Done: the golden red as missing, recorded in Node with `AUTOMATA_UPDATE_GOLDENS=1` (a new file; no existing golden changed), and the node replay 11 of 11. `core-input-rebind.e2e.ts` passed 4 of 4 (`examples` and `examples-compact`) on its first run, Escape cancelling a capture (I-k) included. The reload is the game frame's own (`location.reload()`), and the fake host keeps the saves. Play's use of the new key is covered by the game unit test (I-h), not the E2E.*
- [x] **13. Exports, reports, gates and records.**
  - *Regenerate,* in order: `pnpm build`, `pnpm api-report --update`, `pnpm cheatsheet`, `pnpm api-index`, `pnpm agent-skills --write`.
  - *Changeset:* runtime, ui and game patches.
  - *Gates:* `pnpm format`, `pnpm check`, CI extras, `pnpm test:parity`, `CI=1 pnpm test:e2e`, prepare-ruken.
  - *Records:* tick 02, add an execution row, update 03.
  - *Done:* the first regenerate failed in `api-index` (8 new ui exports had no doc comments), then passed. Gates, `TURBO_FORCE=true`, first attempts: check 30 of 30, CI extras passed, parity 12 of 12, e2e 105 passed and 2 skipped, prepare-ruken passed.

## Verification

Run the full local gates before the PR is opened. No existing golden may change: no sim code changes, and the new example's golden is a new file.

**Owner acceptance:** none of its own beyond the M4 device gates (spec §13), which M4.10 owns. A real controller and phone rebinding run is part of that gate. The Settings screen's look is in the plain default style, like the other default screens.
