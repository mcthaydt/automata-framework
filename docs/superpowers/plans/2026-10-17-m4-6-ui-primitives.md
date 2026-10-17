# M4.6 Remaining `ui` primitives: TDD plan

- **Task:** M4.6 in [02](../../02-master-delivery-plan.md); M4 spec [§4.8](../specs/2026-10-16-m4-input-display-design.md) (the primitives), §4.12 (colour and accessibility), §7 (states); acceptance U-a and U-b.
- **Lane:** ui. **Depends on:** M4.0 (merged). It does not need M4.5: see "Pad adjust" below.
- **Status:** In progress.
- **Progress:** 6 of 13 steps.

## Sources, read at these commits

- **FloorFifty at `ac72660`:**
  - `apps/client/src/ui/layout/split.ts` (7 lines) and `Split.svelte` (51);
  - `layout/OptionGroup.svelte` (71);
  - `layout/pager.ts` (8) and `PagerDots.svelte` (113);
  - `ui/tile-pages.ts` (129), page arithmetic only;
  - `components/Chip.svelte` (64), `Modal.svelte` (257) and `MenuSheet.svelte` (53);
  - their tests: `tests/client/ui/layout/helpers.test.ts` (`pagerMode`, `splitMode`), `layout/option-group.test.ts`, `layout/pager-dots.test.ts`, `tile-pages.test.ts` and `modal.test.ts`.
- **What AF takes from them:** the rules, without FloorFifty's look. The look comes from AF's `theme.css` tokens and `.af-control`. Strings that FloorFifty took from Paraglide are props here.
- **Ruken `packages/ui` (Button, IconButton, Toast) is not readable in this session.** It is neither vendored nor on disk, and attaching another repository is refused. These three are built new to the rules the spec states (§4.8: IconButton always has an accessible name; Toast is a polite live region that never steals focus) and to AF's Dialog, which came from Ruken's `Dialog.svelte` at `b30d31b`. This is recorded as a deviation; Ruken's component tests can be compared once the source is reachable.

## Decisions this plan makes

- **Native inputs, so a pad adjusts them.** M4.5's `FocusNavigator.adjust` (on `claude/clever-pasteur-ujmu6e-m4-5`, not yet merged) steps a focused `<input type="range">` and cycles a named group of `<input type="radio">`. So Slider is a native range, Toggle is a native checkbox with `role="switch"`, and OptionGroup is a `<fieldset>` of named native radios, where FloorFifty used `<button role="radio">`. They get keyboard arrows from the browser today, and pad adjust once M4.5 merges, with no code in M4.6 depending on M4.5.
- **Modal scoping is shared.** Dialog's scoping becomes `dialog/modal-scope.ts`: inert outside, the topmost check, the Tab wrap, initial focus and focus return. Dialog, Modal and Sheet use it. Dialog's existing tests and its layout contract are the regression guard for the move.
- **The one-file `ui/ui-*.ts` examples move to M4.4.** A one-file example may import only `@mcthaydt/automata*` entries and `zod`. Putting a Svelte primitive on screen today needs either a custom `ScreenDef` (whose `enter` returns an Effect, and `effect` is not an allowed import) or Svelte's `mount`. M4.4 adds the core Settings screen and renders the `settings.sections` slot, which is the first public route for a game to show a ui component. So the examples follow it there: a 02 follow-up row records the move. M4.6 instead adds every new primitive to the `ui/primitives` fixture viewer, which the EX spec §6 keeps as the ui package's fixture page. **This needs the Owner's review with the plan.**
- **Every visible string is a prop.** English defaults are allowed only where an existing primitive already has them (CornerControls' `backLabel = 'Back'`), and are named in each step.

## Files

| Create | Purpose |
|---|---|
| `packages/ui/src/layout/split.ts`, `Split.svelte`, `split.test.ts` | Split |
| `packages/ui/src/layout/OptionGroup.svelte`, `option-group.test.ts` | OptionGroup |
| `packages/ui/src/layout/pager.ts`, `PagerDots.svelte`, `pager-dots.test.ts` | PagerDots |
| `packages/ui/src/layout/paged-grid.ts`, `PagedGrid.svelte`, `paged-grid.test.ts` | PagedGrid |
| `packages/ui/src/controls/Button.svelte`, `IconButton.svelte`, `button.test.ts` | Button, IconButton |
| `packages/ui/src/controls/Toggle.svelte`, `Slider.svelte`, `toggle-slider.test.ts` | Toggle, Slider |
| `packages/ui/src/status/Chip.svelte`, `chip.test.ts` | Chip |
| `packages/ui/src/dialog/modal-scope.ts`, `modal-scope.test.ts` | Shared modal scoping |
| `packages/ui/src/dialog/Modal.svelte`, `Sheet.svelte`, `modal.test.ts` | Modal, Sheet |
| `packages/ui/src/status/Toast.svelte`, `toast.test.ts` | Toast |
| `packages/ui/src/testing/PrimitivesFixture.svelte` | One fixture per primitive, chosen by a `primitive` prop |
| `packages/ui/src/m4-primitives.layout.test.ts` | U-a: every new primitive at every reference size and variant, in three engines |

| Modify | Why |
|---|---|
| `packages/ui/src/dialog/Dialog.svelte` | Uses `modal-scope.ts`; no behaviour change |
| `packages/ui/src/theme.css`, `theme.test.ts` | A `--af-success` token if Toast or Chip needs one, with its contrast pairs |
| `packages/ui/src/index.ts`, `index.test.ts` | The exports |
| `examples/ui/primitives/main.ts`, `src/Gallery.svelte`, `src/gallery.smoke.test.ts`, `e2e/primitives.e2e.ts` | The new primitives in the fixture viewer |
| `docs/02-master-delivery-plan.md` | The M4.6 row, its execution record, and the follow-up row for the moved `ui/ui-*.ts` examples |

## Interfaces

| Produced | Consumers |
|---|---|
| `Split`, `splitMode` | M4.4 (Settings at `wide`), PRODUCT.6 |
| `OptionGroup` | M4.4 (Display: quality; Controls: touch mode) |
| `PagerDots`, `pagerMode`, `PagedGrid`, `paginate`, `fitShape`, `tileSide`, `pageOf`, `wrapPage`, `trimRows`, `fitColumns` | PRODUCT.6, games |
| `Button`, `IconButton`, `Toggle`, `Slider`, `Chip` | M4.4, M4.7, M5 (audio volumes) |
| `Modal`, `Sheet`, `Toast` | M4.4 (save refused), M4.2's "not supported" pad toast, M4.7 |

## Steps

Each step starts with a failing test whose failure reason is confirmed and recorded here, then the minimal change.

1. [x] **Plan.** This file, committed first.
2. [x] **Split.** Red: `Failed to resolve import "./Split.svelte"`; green 6 of 6. jsdom has no ResizeObserver, so the measured case stubs one. `split.test.ts`:
   - Red: FloorFifty's `splitMode` cases (row when `2 × min + gap` fits, stack otherwise).
   - Red (DOM): stacked until measured; `data-split="row"` once a measured width fits; both panes render.
3. [x] **OptionGroup.** Red: `Failed to resolve import "./OptionGroup.svelte"`; then `expected false to be true` for `disabled`, because a disabled fieldset leaves each radio's `disabled` property false, and M4.5's `adjust` reads that property. So each radio carries `disabled` itself. Green 6 of 6; `svelte-check` clean. `option-group.test.ts`, from FloorFifty's:
   - Red: a `<fieldset>` whose `<legend>` is the `label`, and one named radio per option;
   - Red: the radio for `value` is checked, and none is while `value` is `undefined`;
   - Red: a change reports the option's value through `onchange`, and the checked radio still follows `value` (controlled);
   - Red: `disabled` disables every option;
   - Red: `ariaLabel` names an option whose face is a symbol.
   - The checked option shows a mark as well as its fill, so the choice is not colour alone.
4. [x] **PagerDots.** Red: `Failed to resolve import "./PagerDots.svelte"`; green 10 of 10. The dot size scales with `--af-scale` when measured, so the dots-or-counter choice holds under Ruken's TV scale. The current dot is larger as well as brighter. `pager-dots.test.ts`:
   - Red: FloorFifty's `pagerMode` cases;
   - Red: one 44 px dot per page, the current one `aria-current`, and a tap reports its index;
   - Red: past `max`, or when the measured width is too narrow, a counter `"3 / 11"` in a polite live region;
   - Red: each dot's name comes from the `dotLabel(position, total)` prop (default `Page 3 of 11`).
5. [x] **PagedGrid.** Red: `Failed to resolve import "./PagedGrid.svelte"`; green 19 of 19. Groups are `{ id, title, items }`, so FloorFifty's `packId` becomes `id`. The continuation title is a prop (`continued`, default "Title (2)"). The props interface lives in the module script, because a generic component needs it exported under `isolatedDeclarations`. `paged-grid.test.ts`:
   - Red: the page arithmetic from `tile-pages.test.ts`, generic over the item type (`paginate`, `fitShape`, `tileSide`, `trimRows`, `fitColumns`, `pageOf`, `wrapPage`). FloorFifty's tile types and `stackedSide` stay in FloorFifty.
   - Red (DOM): it renders one page of `item` snippets in a `[data-focus-grid]`, never scrolls (`overflow: hidden`), shows PagerDots for the pages, and reports `onpage` from the dots. The page is controlled by its owner.
6. [x] **Button and IconButton.** Red: `Failed to resolve import "./Button.svelte"`; green 7 of 7; `svelte-check` clean. IconButton's mount-time label check is deliberate, so Svelte's `state_referenced_locally` warning is ignored beside it with the reason. `button.test.ts`:
   - Red: Button renders `.af-control` with `kind` primary (and `data-kind="primary"`, so the layout check sizes it 48 px), secondary or ghost; `disabled` disables it;
   - Red: IconButton's accessible name is its `label` prop, and the icon is `aria-hidden`;
   - Red: an IconButton with an empty `label` throws while it mounts, so a nameless one cannot ship.
7. [ ] **Toggle and Slider.** `toggle-slider.test.ts`:
   - Red: Toggle is a checkbox with `role="switch"`, and its `onLabel` and `offLabel` text shows the state (not colour alone); a click reports `onchange(checked)`.
   - Red: Slider is a labelled `<input type="range">` with `min`, `max` and `step`; an `input` event reports the value; `valueText` gives the value its words (`aria-valuetext`);
   - its thumb is a 44 px target (checked in the layout contract, step 11).
8. [ ] **Chip.** `chip.test.ts`:
   - Red: `tone` `info`, `success`, `warning` or `danger` is `data-tone`;
   - Red: a non-`info` tone shows a glyph (`aria-hidden`) and its `toneLabel` text for assistive technology. With colour removed, the tone still reads (§4.12).
9. [ ] **Modal scoping moved, then Modal and Sheet.**
   - Red (`modal-scope.test.ts`): `inertOutside` marks only what it marked and undoes exactly that; `isTopmost` picks the last non-inert `aria-modal`; `wrapTab` wraps both ways. These are Dialog's current rules, now importable.
   - Dialog moves onto it; `dialog.test.ts` and `dialog.layout.test.ts` pass unchanged.
   - Red (`modal.test.ts`, from FloorFifty's):
     - Modal is a labelled modal dialog;
     - focus moves in on open, Tab wraps, Escape closes and focus returns to the opener;
     - the visible Close button is named by `closeLabel`;
     - a tap on the scrim calls `onbackdrop` only when one is given.
   - Red: Sheet is the same scoping, anchored to the bottom edge at every form factor, with its body a declared scroll region.
10. [ ] **Toast.** `toast.test.ts`:
    - Red: a polite live region (`role="status"`); an `error` toast is `role="alert"`;
    - Red: mounting it never moves focus;
    - Red (U-b): an `error` toast shows a glyph and its `toneLabel` text, and its tone is readable with every colour removed. The test reads the text content and the attributes, not the computed colours.
    - Red: under reduced motion it does not slide (`data-motion="none"`).
    - It sits above `hostReserved` and the keyboard, through the geometry owner's inset variables; the layout contract checks this.
11. [ ] **Layout contracts (U-a).** `m4-primitives.layout.test.ts` mounts `PrimitivesFixture` for each new primitive at every reference size and variant, in Chromium, WebKit and Firefox, and runs `checkLayout`:
    - Red before each fixture exists;
    - essentials named per primitive: OptionGroup's options, the dots, the Slider thumb, Modal's Close, Sheet's actions, the Toast;
    - no 44 px target shrinks under `scale`, nothing sits under the keyboard or Ruken's strip, and the document never scrolls.
12. [ ] **Fixture viewer and exports.**
    - `examples/ui/primitives` lists the new primitives, and its smoke and E2E cover them.
    - `index.ts` exports them; `index.test.ts` pins the names.
    - A ui changeset (minor if the API report counts additions as minor, else as `check-changesets` decides).
    - Doc comments on every export (`pnpm api-index` fails without them).
    - The 02 follow-up row for the moved `ui/ui-*.ts` examples.
13. [ ] **Verify and record.**
    - `pnpm format`; `pnpm check` (`TURBO_FORCE=true`).
    - The CI checks-job extras (`api-report --update`, `pnpm cheatsheet`, `pnpm api-index`, `pnpm agent-skills --write`, `build`, `test:dist`, `check-changesets`).
    - `pnpm test:parity`; `CI=1 pnpm test:e2e`; `prepare-ruken` for both games.
    - Tick the M4.6 row in 02, and record the evidence in 02's execution record and in 03.

## Acceptance mapping

| Case | Test |
|---|---|
| U-a | `m4-primitives.layout.test.ts` (each primitive, every reference size and variant, three engines) |
| U-b | `toast.test.ts` (an error toast's tone in text and glyph), plus `chip.test.ts` and `toggle-slider.test.ts` for the other status primitives (§4.12) |

## Owner acceptance (not claimed)

- How the primitives look on real phones, and the fixture viewer's screenshots (`screenshots-approved.json`).

## Risks

- **Moving Dialog's scoping can regress Dialog.** Its unit tests and layout contract run unchanged after the move, before Modal and Sheet are written.
- **Native range thumbs differ by engine.** The 44 px thumb is set through `::-webkit-slider-thumb` and `::-moz-range-thumb`, and the layout contract measures the input's box in all three engines. If an engine cannot size the thumb, the input's own height (44 px) is the target, and that is recorded.
