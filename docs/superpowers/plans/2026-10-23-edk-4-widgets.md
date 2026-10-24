# EDK.4 Field widgets and overlays: TDD plan

- **Task:** EDK.4 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.6 (widgets), §6 (a widget error is contained), §7 (44 px targets at every size); decisions EDK-D2, EDK-D5; acceptance EK-a, EK-c (the widget half).
- **Lane:** editor-kit. **Depends on:** EDK.1 (tokens, the package) and EDK.3 (the stepper, slider and reorder list read the pointer pipeline). This PR stacks on #133 (EDK.3). **Unblocks:** ED2D.4 (the layer panel, palettes and entity inspector are built from these) and the 3D editor's inspector.
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-edk4`. The kit spec is drafted, not reviewed.
- **Progress:** 9 of 9 steps. Implemented and locally checked 2026-10-23 (Chromium only); not CI verified.

## Scope

**In:** twelve Svelte 5 components and their pure helpers in `packages/editor-kit/src/widgets/`: `Stepper`, `Slider`, `Segmented`, `Chips`, `Swatch` and `ColorField`, `Tabs`, `Dialog`, `ToastRegion` with the `createToasts` store, `StatusLine`, `Menu`, `Picker` (both on an internal `Popup`) and `ReorderList`. Behavior is tested in jsdom through Testing Library; the 44 px hit areas, the absence of horizontal overflow and the focus ring are tested with production CSS in a real browser (the `layout` project, Chromium until EDK.6).

**Out, with owner:**

| What | Where |
|---|---|
| Domain widgets built from these (layer row, tile palette, vec3, rule-pattern cell) | The editor that needs them (ED2D.4 to ED2D.6, the 3D editor) |
| Wiring an edit event to `History` | The editor: `set` is `history.apply`, `start`/`update`/`commit`/`cancel` are a transaction |
| Validating a value against a `FieldDef` | The editor passes `validate` (the kit's `checkFieldValue` in the `./fields` entry) |
| WebKit and Firefox layout, real touch and Pencil | EDK.6, then the Orchestrator's device pass |
| Owner visual acceptance of the widget look | Never ticked by an agent; the Figma `Editor Kit` components are the reference |

## Decisions made here (written into the kit spec in this PR)

1. **One edit event.** `EditEvent<T> = { value: T; phase: 'set' | 'start' | 'update' | 'commit' | 'cancel' }`. `set` is one discrete change (a typed value, a step button, an arrow key, a tap on an option). `start`, `update`, `commit` and `cancel` bracket a drag; `cancel` carries the value to go back to, and a drag that ended where it began is reported as `cancel`, so a no-op never becomes an undo step. Every value widget takes `value` (the editor's state is the truth, and `bind:value` also works) and `onedit`.
2. **A disabled widget stays focusable.** It is `aria-disabled`, not `disabled`, so a person on a touch screen can find out why: its `reason` is the accessible description and the tooltip, and pressing it calls `onblocked(reason)` so the editor can toast it. It never calls `onedit`.
3. **Typing is refused, scrubbing is clamped.** Dragging, the step buttons and the arrow keys clamp to `min` and `max` and show a stop (`data-at-limit`); a typed value outside the bounds, not a number, or refused by `validate` is rejected with a message and the value keeps its previous number (spec G-e). A scrub moves `step` for every `pixelsPerStep` (default 4) pixels from where the press began, so a 40 px drag is ten steps; steps are rounded to the step's decimals, so 0.1 never drifts.
4. **Hit areas.** Every interactive element is at least `--size-hit` (44) square, the primary action of a dialog `--size-primary` (48); a smaller glyph gets a padded target, not a smaller box. A layout test measures every interactive element of a gallery of all widgets at 1194 × 834, 834 × 1194, 390 × 844 and 900 × 600.
5. **Dialog owns its focus; it is not a native `<dialog>`.** On open it remembers the focused element, moves focus to the first `[data-autofocus]` or first focusable (else the dialog), keeps Tab and Shift+Tab inside, closes on Escape or a scrim press (unless `dismissible` is false), and puts focus back where it was. The reason is jsdom and the editor's own scrim; `role="dialog"` and `aria-modal` carry the semantics.
6. **Toasts are a store.** `createToasts({ clock })` holds up to three toasts (the oldest drops), each with a kind, a message, an optional action, and a duration (5 s, 8 s with an action, 0 sticks); its timers come from the injected clock. `ToastRegion` is a polite live region that never takes focus.
7. **Menu and Picker share a `Popup`** with two presentations chosen by the editor from the shell mode: a popover under its trigger on `wide`, a bottom sheet on `medium` and `compact`. The popup closes on Escape or an outside press and returns focus to its trigger.
8. **`ReorderList` reports one reorder at the drop.** `onreorder({ id, from, to })` fires once, on release (or on Space/Enter after a keyboard lift); a cancelled drag, Escape, or a drop in place fires nothing. A locked row has no handle action and the others cannot be dropped onto its place (the target moves to the nearest unlocked place). Near the top or bottom edge of the scrolling ancestor the list scrolls itself, faster the closer the pointer is. Every move is announced in a live region ("Moved fog to place 2 of 5").
9. **Colours are palette-first.** `ColorField` opens a grid of swatches (a radio group) and a "Custom" button that reveals a hex field (`#rrggbb`, either case) next to the browser's colour input; an invalid hex is refused like any typed value.

## Contract

```ts
// widgets/edit-event.ts
export type EditPhase = 'set' | 'start' | 'update' | 'commit' | 'cancel'
export interface EditEvent<T> { readonly value: T; readonly phase: EditPhase }

// Shared by every value widget: { disabled?: boolean; reason?: string; onblocked?(reason: string | undefined): void }
// Stepper:  { label; value: number; min?; max?; step?; unit?; integer?; pixelsPerStep?; validate?(n): string | undefined; error?; onedit? }
// Slider:   { label; value: number; min; max; step?; defaultValue?; unit?; onedit? }
// Segmented:{ label; options: { id; label; disabled?; reason? }[]; value: string; onedit? }
// Chips:    { label; items: { id; label; removable?; disabled?; reason? }[]; selected: readonly string[]; mode: 'single' | 'multi'; onedit?; onremove?(id) }
// Swatch:   { color: string; label: string; selected?: boolean; onpress? }   ColorField: { label; value: string; palette: readonly string[]; onedit? }
// Tabs:     { label; tabs: { id; label; disabled?; reason? }[]; value: string; onselect?(id); panel: Snippet<[string]> }
// Dialog:   { open: boolean; title; dismissible?; onclose?(why: 'escape' | 'scrim' | 'action'); children; actions? }
// createToasts(options?): { push(toast): string; dismiss(id): void; items: readonly Toast[]; subscribe(run): () => void }
// ToastRegion: { toasts }     StatusLine: { message?; save: 'saved' | 'dirty' | 'saving' | 'error' | 'device'; children? }
// Menu:     { label; items: (MenuItem | 'separator')[]; presentation?: 'popover' | 'sheet'; onselect?(id) }
// Picker:   { label; options: PickerOption[]; value?: string; presentation?; searchable?; onpick?(id) }
// ReorderList: { label; items: { id; label; locked? }[]; item?: Snippet<[...]>; onreorder?(move) }
```

## Files

Create, all under `packages/editor-kit/src/widgets/` unless noted: `edit-event.ts`, `widget-math.ts` (clamp, decimals, rounding, next enabled index), `stepper-model.ts`, `Stepper.svelte`, `Slider.svelte`, `Segmented.svelte`, `Chips.svelte`, `Swatch.svelte`, `ColorField.svelte`, `color.ts`, `Tabs.svelte`, `focus-trap.ts`, `Dialog.svelte`, `toasts.ts`, `ToastRegion.svelte`, `StatusLine.svelte`, `Popup.svelte`, `Menu.svelte`, `Picker.svelte`, `picker-model.ts`, `reorder-model.ts`, `ReorderList.svelte`, a `*.test.ts` beside each, `widgets.layout.test.ts`; `src/testing/WidgetGallery.svelte`, `src/testing/DialogFixture.svelte`, `src/testing/TabsFixture.svelte`, `src/testing/ReorderFixture.svelte`.
Modify: `src/index.ts`, `tooling/api-report/reports/editor-kit.api.md`, the kit spec (§4.6), `docs/02-master-delivery-plan.md`, `docs/03-continuation-prompt.md`.

## Steps

Each step starts with a failing test and the reason it fails.

- [x] **1. Edit events, the math, and the Stepper.** Fails: nothing exists. Tests (pure, `widget-math` and `stepper-model`): clamp, the decimals of a step, rounding to a step grid without drift (0.1 × 3 is 0.3), the next enabled index with wrap and skipping disabled; parsing typed text (`"12"`, `" 3.5 "`, `"1e2"`, `""`, `"abc"`) and the refusal messages (not a number, below the minimum, above the maximum, not whole). Component (jsdom): renders label, value and unit with `role="spinbutton"` and its `aria-value*`; the step buttons and arrow keys emit `set` and clamp with `data-at-limit`; PageUp/Down move ten steps; tapping the value opens a text field with the value selected, Enter emits `set`, Escape restores, blur commits; an invalid text emits nothing, shows the message in a `role="alert"`, sets `aria-invalid`, and the value is unchanged; `validate` can refuse; a drag on the label by 40 px emits `start`, `update`s and `commit` (EK-a: ten steps), a cancelled pointer emits `cancel` with the start value, a drag back to the start emits `cancel`; a disabled stepper emits nothing, calls `onblocked(reason)` and names the reason in its description.
- [x] **2. Slider and Segmented.** Fails: not exported. Tests: the slider is `role="slider"` with value, min, max and the readout; arrows, PageUp/Down (ten per cent), Home and End emit `set`; a drag emits `start`/`update`/`commit` with the value under the pointer, clamped and snapped to `step`; a double tap resets to `defaultValue` (and does nothing without one); disabled blocks as in step 1. Segmented is a `radiogroup` of `radio` buttons; a press or arrow emits `set` for an enabled option; arrows skip disabled options and wrap; a pressed disabled option calls `onblocked` with its reason and emits nothing; only the selected option is in the tab order.
- [x] **3. Chips, Swatch and ColorField.** Fails: not exported. Tests: single mode keeps one selected chip, multi toggles; `aria-pressed`; a removable chip's × is its own 44 px button and calls `onremove(id)`; disabled chips block with a reason. `color.ts` accepts `#rrggbb` in either case and refuses everything else; a swatch is a labelled button with `aria-pressed`; `ColorField` shows its current colour closed, opens a palette radio group on press, a palette pick emits `set` and closes, "Custom" shows a hex field that refuses a bad value with a message and accepts a good one, Escape closes and returns focus to the trigger.
- [x] **4. Tabs and Dialog.** Fails: not exported. Tests: tabs are a `tablist` with `tab`s and the active `tabpanel` (labelled by its tab); arrows, Home and End move and activate, skipping disabled tabs; only the active tab is in the tab order; a disabled tab calls `onblocked`. The dialog renders nothing closed; open, it is `role="dialog"` with `aria-modal` and `aria-labelledby` its title, moves focus to `[data-autofocus]` or the first focusable, keeps Tab and Shift+Tab inside, closes on Escape and on a scrim press with `onclose('escape' | 'scrim')`, ignores both when not `dismissible`, and returns focus to the element focused before it opened (EK-c, the widget half: closing never loses the opener).
- [x] **5. Toasts and StatusLine.** Fails: not exported. Tests (store, `TestClock`): `push` returns an id and notifies subscribers; a toast expires after 5 s, 8 s with an action, never with 0; the fourth toast drops the oldest; `dismiss` removes one and stops its timer; the action runs and dismisses. Region: a polite `role="status"` live region, each toast with its message and action button (44 px), a dismiss button, and focus unmoved when one appears. `StatusLine` shows the message and a save state pill with its text ("Saved", "Unsaved changes", "Saving…", "Save failed", "Not saved on this device") and `data-save`.
- [x] **6. Popup and Menu.** Fails: not exported. Tests: a menu button has `aria-haspopup="menu"` and `aria-expanded`; Enter, Space and ArrowDown open it and focus the first enabled item, ArrowUp the last; arrows, Home and End move, skipping disabled items and separators; typing letters jumps to the next item starting with them; Enter or a press selects, calls `onselect(id)`, closes and returns focus to the trigger; Escape and an outside press close; a disabled item calls `onblocked` with its reason and keeps the menu open; `presentation="sheet"` renders the same items in a bottom sheet with a scrim.
- [x] **7. Picker.** Fails: not exported. Tests (`picker-model` pure, then component): filtering is case-insensitive over label and detail and keeps group order; the closed picker shows the selected option's label or the placeholder; open shows a `listbox` of `option`s with `aria-selected`; typing filters (searching), none left shows an empty state ("No matches for …") and picks nothing; Enter picks the active option and closes; groups render a heading; disabled options block with their reason; a picker with at most eight options has no search field unless `searchable` is set; the sheet presentation works as in step 6.
- [x] **8. ReorderList.** Fails: not exported. Tests (`reorder-model` pure): the target index from a pointer position over rows of known heights; locked rows are skipped (the target moves to the nearest unlocked place); the auto-scroll speed is zero in the middle, grows to a maximum at the edge and is signed; a move result for keyboard steps clamps at the ends. Component: each row has a 44-wide handle; Space on a handle lifts the row (`aria-pressed`), ArrowUp/Down move it (announced in the live region), Space or Enter drops and calls `onreorder` once, Escape cancels with no call; dropping in place calls nothing; a locked row cannot be lifted and says so; a pointer drag on a handle (rows with stubbed boxes) moves the row, drops it once, and a cancelled pointer drops nothing.
- [x] **9. Gallery, layout contract, docs and gates.** Fails: no gallery fixture. Layout tests in Chromium with production CSS: every interactive element in the gallery is at least 44 × 44 (48 for a dialog's primary action) at the four sizes, none overflows the page horizontally, the focus ring is visible on every kind of control when focused with the keyboard, and the dialog stays inside the visible area at 390 × 844. Then amend kit spec §4.6, tick the rows, `pnpm api-report --update`, repo-level lint, style, knip, boundaries, the package's `typecheck` and whole unit and layout suites.

## Gates

`pnpm --filter @mcthaydt/automata-editor-kit test:unit`, `test:layout` and `typecheck`; repo-level `pnpm lint`, `style`, `knip`, `boundaries`, `api-report`. Not run here: CI, WebKit and Firefox, real touch and Pencil, `pnpm deps:new` (no dependency is added), the full-repo `test:unit` (run once before the PR leaves draft).

## Execution record

Branch `claude/project-thread-73sp69-edk4`, stacked on #133 (EDK.3). The plan landed first (2f2aa3f); one commit per step group after it: the edit events, math and Stepper (abedd29), Slider and Segmented (2f2056e), Chips, Swatch and ColorField (670f2f0), Tabs and Dialog (2dba29f), toasts and StatusLine (9e81451), Popup and Menu (32fb5e9), Picker (9020d44), ReorderList (b0a145d), and the gallery, layout contract, exports and docs in the commit after them.

**Evidence (2026-10-23, in the cloud container, Chromium only):** `pnpm --filter @mcthaydt/automata-editor-kit test:unit` 36 files, 465 tests pass; `test:layout` (Chromium, through the untracked container config that points at the preinstalled browser) 2 files, 65 tests pass, 24 of them the new `widgets.layout.test.ts`; `typecheck` (svelte-check, warnings fail) 0 errors and 0 warnings; repo-level `pnpm style` 0 findings, `pnpm knip` and `pnpm boundaries` clean; `pnpm lint` exits 0 with the warnings the repo already had (none in `packages/editor-kit`: `biome check packages/editor-kit` is clean); `pnpm api-report --update` added the widget exports to `editor-kit.api.md`.

**Mutation checks (by hand, each reverted):** each widget group was mutated after its tests passed (the layout contract too). Two mutants survived and were closed with a test each: the `mousedown` `preventDefault` that keeps focus on the popup trigger (a test now presses a menu item and asserts where focus is), and the reorder list announcing "Move cancelled" for a press that never moved (it is now silent, with a test).

**Deviations from the plan, with reasons:**

- **Extra modules the plan did not list:** `popup-model.ts` (the placement rule, kept pure so the viewport arithmetic is tested without a layout engine), `menu-model.ts` (type-ahead), and `testing/MenuInDialogFixture.svelte`. `Popup.svelte` portals into the nearest `[data-dialog-root]`, else the body, so a menu opened inside a dialog is inside the dialog's focus trap; that case has its own tests.
- **A portalled node must remove itself.** Svelte removes a block's DOM by walking its own range, so a node an action moved elsewhere is left behind unless the action's `destroy` calls `node.remove()`; this leaked popups between tests until it did.
- **Disabled controls stay focusable.** Every widget with a `disabled` prop sets `aria-disabled`, keeps its tab stop, names the reason as its description and calls `onblocked(reason)` when pressed; keyboard arrows skip disabled entries. Written into the kit spec §4.6 with the other as-built decisions.
- **`ReorderList` handles its own pointer events** rather than the EDK.3 `attachGestures` pipeline: a reorder is a press on a 44-wide handle that follows the pointer from the first move, which the recognizer's slop and long-press timing would delay. The cancel and commit rules are the same as the stepper's.
- **Rows move by transform while dragging** and the list is re-ordered only on drop, so focus does not leave the handle (a keyed `{#each}` moves nodes and drops focus).
- **Layout contract:** the dialog's action buttons needed their own focus ring (`.actions :global(button:focus-visible)`), which the first layout run found missing.

**Not done here, by design:** the app-level use of these widgets (the layer panel, palettes and inspector, ED2D.4), real touch and Pencil hardware on the scrub and the reorder drag (EDK.6, then the Orchestrator's device pass), WebKit and Firefox layout (the layout project is Chromium-only until EDK.6), Owner visual acceptance of the widget look.

**Still pending:** CI on the PR, the full-repo `test:unit` (run once before the PR leaves draft), `pnpm deps:new` (unreachable in the container; no dependency was added), review of the kit spec amendments. If #137 (ED3D.3) merges first, `editor-kit.api.md` will need regenerating on this branch for its `./core` section.
