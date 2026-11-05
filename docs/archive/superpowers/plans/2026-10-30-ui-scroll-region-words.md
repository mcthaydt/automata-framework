# UI.L3a-fix: a scrolling control's words are not "run past its edge"

Status: implemented 2026-10-30 (coordinator). Follow-up of PRODUCT.L3a (#210, `d5bf155`).

## Problem

PRODUCT.L3a added `findSpilledWords` to `checkLayout` (`packages/ui/src/testing/layout-contract.ts`). `drawnWords` cut a text node's box to every clipping box between it and the control, but stopped at the control without considering the control's own overflow. editor-2d's error panel lines are a focusable scroll region (`overflow-x: auto`, long lines scroll rather than wrap, required by its own test), so `checkLayout` reported "div's words run past its edge". `main` at `26e2bf0` fails `packages/editor-2d/src/app/document/open-flows.layout.test.ts` (8 sizes x 3 browsers), which turns every PR's parity job red.

## Change

- Test first (`packages/ui/src/testing/layout-contract.layout.test.ts`): "passes words a control scrolls to on purpose: a scroll region with long lines" (failed in Chromium, WebKit and Firefox before the fix) and "fails a control that cuts its words off without scrolling" (pins the Toggle case L3a was written for; passed before and after).
- `drawnWords`: on reaching the control, clip to it on each axis whose overflow is `auto` or `scroll`. `hidden` and `clip` still count as cutting the words.
- Changeset: `@mcthaydt/automata-ui` patch.

## Execution log

- [x] New scroll-region test fails in three browsers for the expected reason; the cut test passes.
- [x] Fix; `layout-contract.layout.test.ts` 72/72 and editor-2d `open-flows.layout.test.ts` 72/72 in three browsers.
- [x] `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm --filter @mcthaydt/automata-ui test:parity`, `pnpm --filter @mcthaydt/automata-editor-2d test:parity`.
