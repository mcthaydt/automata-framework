# EDK.8 Region error boundary in EditorShell: TDD plan

- **Task:** EDK.8 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §6 (the "Unhandled error in a widget" row) and §4.2 (the shell's regions).
- **Lane:** editor-kit. **Depends on:** EDK.1 (merged as #106). **Unblocks:** nothing directly; both editors get the boundary through `EditorShell`.
- **Status:** Drafted 2026-10-30.
- **Progress:** 0 of 5 steps.

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
3. **Two layouts.** In the bars (`topbar`, `status`, and the rail when it is a tab bar) the panel is one row: the message, a one-line details box and the Copy button. Everywhere else it is a block that fills the region. Copy details is at least `--size-hit` (44 px) in both; a bar grows to fit it.
4. **The panel is `role="alert"`**, so a screen reader hears that a region failed.

## Contract

`packages/editor-kit/src/shell/region-error.ts` (pure, unit tested):

```ts
export function regionErrorDetails(region: ShellSnippetRegion, error: unknown): string
export const REGION_LABEL: Record<ShellSnippetRegion, string>
export type ShellSnippetRegion = 'topbar' | 'rail' | 'panel' | 'canvas' | 'inspector' | 'dock' | 'status'
```

`packages/editor-kit/src/shell/RegionError.svelte` (props `region`, `error`, `layout: 'bar' | 'block'`): `data-region-error={region}`, a message "The <label> stopped working.", the details box, and a "Copy details" button that reports "Copied" or the fallback message in a polite status line.

`EditorShell.svelte` consumes both. No new exports from the package entry: the boundary is internal to the shell.

## Steps (each: failing test first, confirm the reason, minimal change, verify)

1. [ ] `region-error.test.ts`: details text for an `Error` with a stack, an `Error` without one, and a thrown string. Fails: module missing.
2. [ ] `RegionError.test.ts` (jsdom): renders the message and details; Copy details calls the clipboard and says "Copied"; with no clipboard, and with a clipboard that rejects, it says so and the details box holds the selection; the Copy button is a real `button`. Fails: component missing.
3. [ ] `editor-shell-boundary.test.ts` (jsdom), with a `BoundaryFixture.svelte` in `src/testing/` that breaks one named region: for each of the seven regions, a throw at first render replaces only that region's content with the panel; the other six regions still render their content and their buttons and fields still work (a click toggles the panel, typing reaches the canvas field). A second case breaks a region after a click (a widget whose derived value throws), proving the boundary catches errors from a later update, not only the first render. Fails: no boundary, the error escapes `render`.
4. [ ] `EditorShell.svelte`: wrap each region's content in `<svelte:boundary>` with the `failed` snippet; a sheet keeps its handle outside the boundary. Steps 2 and 3 pass.
5. [ ] Layout (Chromium, the existing `editor-shell.layout.test.ts` plus one new case): a broken panel at 1194×834 and a broken status at 390×844 show Copy details at least 44 px in both directions, inside the region, with no horizontal page scroll. The existing shell layout tests still pass.

## Gates

`pnpm --filter @mcthaydt/automata-editor-kit exec vitest run --project unit`, `... --project layout` (Chromium; WebKit and Firefox join the kit's layout project in EDK.6a), `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. The kit is private: no changeset, no API report.

## Execution record

- 2026-10-30: plan drafted.
