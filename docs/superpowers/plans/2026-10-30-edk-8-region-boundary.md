# EDK.8 Region error boundary in EditorShell: TDD plan

- **Task:** EDK.8 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §6 (the "Unhandled error in a widget" row) and §4.2 (the shell's regions).
- **Lane:** editor-kit. **Depends on:** EDK.1 (merged as #106). **Unblocks:** nothing directly; both editors get the boundary through `EditorShell`.
- **Status:** Implemented and locally checked 2026-10-30 (draft PR from `claude/editors-edk.8-edk-8-region-boundary`). Not CI verified; Owner visual acceptance pending.
- **Progress:** 5 of 5 steps.

## Scope

**In:** every region `EditorShell` renders from a snippet (`topbar`, `rail`, `panel`, `canvas`, `inspector`, `dock`, `status`) is wrapped in a Svelte 5 `<svelte:boundary>` whose `failed` snippet is one error panel, `RegionError.svelte`. The region element itself (its `data-region`, grid area, `inert`, drawer or sheet presentation, and a sheet's handle) stays; only the region's content is replaced. The other regions keep working.

**Out, with owner:**

| What | Where |
|---|---|
| Errors thrown inside an event handler | Svelte boundaries do not catch them (they are not part of rendering or an effect); a handler that throws leaves the region as it was. Each editor's command layer reports its own failures (toasts, spec §6 storage rows) |
| The `sheets` overlay snippet | Not a region: it is dialogs and toasts positioned by themselves, outside the grid, with no box for a panel to fill. Each dialog's owner handles its own failure |
| Sending error reports anywhere | No reporting channel exists in the kit; Copy details is the spec's whole action |
| A "Try again" action | Not in spec §6; left out (no speculative scope) |

## Decisions made here (defaults, listed for the Owner's veto)

1. **Copy details uses `navigator.clipboard.writeText`.** Spec §6 names no fallback, so the panel always shows the details in a read-only, selectable `<textarea>`; when the clipboard is missing or refuses, the panel says so and selects the text in that box, ready for the system's own Copy.
2. **The details text** is the region, the error's name and message, and its stack when there is one, as plain text (`regionErrorDetails`). A thrown non-`Error` is shown with `String(value)`.
3. **Two layouts.** In the bars (`topbar`, `status`, and the rail when it is a tab bar) the panel is one row; everywhere else it is a block that fills the region. The order is the message, Copy details, its status note, then the details box, so the action is in view even in the 148 px dock. Copy details and the details box are both at least `--size-hit` (44 px); a bar grows to fit them. In a column as narrow as the wide rail (56 px, a container query below 120 px) the gutter tightens and the button reads "Copy", keeping its 44 px target and the accessible name "Copy details".
4. **The panel is `role="alert"`**, so a screen reader hears that a region failed.

## Contract

`packages/editor-kit/src/shell/region-error.ts` (pure, unit tested):

```ts
export function regionErrorDetails(region: SnippetRegion, error: unknown): string
export const REGION_LABEL: Record<SnippetRegion, string>
export type SnippetRegion = 'topbar' | 'rail' | 'panel' | 'canvas' | 'inspector' | 'dock' | 'status'
```

`packages/editor-kit/src/shell/RegionError.svelte` (props `region`, `error`, `layout: 'bar' | 'block'`): `data-region-error={region}`, a message "The <label> stopped working.", the details box, and a "Copy details" button that reports "Copied" or the fallback message in a polite status line.

`EditorShell.svelte` consumes both. No new exports from the package entry: the boundary is internal to the shell.

## Steps (each: failing test first, confirm the reason, minimal change, verify)

1. [x] `region-error.test.ts`: details text for an `Error` with a stack, an `Error` without one, and a thrown string. Fails: module missing.
2. [x] `RegionError.test.ts` (jsdom): renders the message and details; Copy details calls the clipboard and says "Copied"; with no clipboard, and with a clipboard that rejects, it says so and the details box holds the selection; the Copy button is a real `button`. Fails: component missing.
3. [x] `editor-shell-boundary.test.ts` (jsdom), with a `BoundaryFixture.svelte` in `src/testing/` that breaks one named region: for each of the seven regions, a throw at first render replaces only that region's content with the panel; the other six regions still render their content and their buttons and fields still work (a click toggles the panel, typing reaches the canvas field). A second case breaks a region after a click (a widget whose derived value throws), proving the boundary catches errors from a later update, not only the first render. Fails: no boundary, the error escapes `render`.
4. [x] `EditorShell.svelte`: wrap each region's content in `<svelte:boundary>` with the `failed` snippet; a sheet keeps its handle outside the boundary. Steps 2 and 3 pass.
5. [x] Layout (Chromium, the existing `editor-shell.layout.test.ts` plus one new case): a broken panel at 1194×834 and a broken status at 390×844 show Copy details at least 44 px in both directions, inside the region, with no horizontal page scroll. The existing shell layout tests still pass.

## Gates

`pnpm --filter @mcthaydt/automata-editor-kit exec vitest run --project unit`, `... --project layout` (Chromium; WebKit and Firefox join the kit's layout project in EDK.6a), `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. The kit is private: no changeset, no API report.

## Execution record

- 2026-10-30: plan drafted (commit 1).
- Step 1: `region-error.test.ts` failed on the missing module, then 4 pass.
- Step 2: `RegionError.test.ts` failed on the missing component, then 5 pass (a later check that the visible label reads "Copy details" failed first on "Copydetails", Svelte trimming the span's leading space, then passed).
- Step 3: `editor-shell-boundary.test.ts` (21 cases) failed with "the widget broke" escaping `render` in every case; `ShellFixture` gained `broken` and `breaks`, with `testing/BrokenWidget.svelte`.
- Step 4: the shell wraps each region; 75 shell unit tests pass. Hand mutations: unwrapping the status region fails 3 cases; dropping a sheet's handle fails the resizable-sheet case.
- Step 5: 13 new Chromium layout cases. First run: 7 failed because the one-line details box was 23 to 24 px tall (a touch target under 44), then 2 failed because Copy details sat below the 148 px dock's fold; fixed by giving the details box `--size-hit` and putting the action before it. All 62 shell layout tests pass in Chromium.
