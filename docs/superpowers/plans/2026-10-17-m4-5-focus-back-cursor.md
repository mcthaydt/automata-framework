# M4.5 Focus navigation, back and cursor policy: TDD plan

- **Task:** M4.5 in [02](../../02-master-delivery-plan.md). M4 spec [§4.7](../specs/2026-10-16-m4-input-display-design.md), §4.2 (context), §5 (screen change), §7 and §8 (focus rows), M4-D10. Acceptance F-a, F-b, F-c.
- **Lanes:** ui (`FocusNavigator` and the FloorFifty ports), runtime (`ScreenDef.kind`, Flow's focus step), and the game lane's default screens. This session owns all three. **Depends on:** M4.0 (merged). It is stacked on M4.2 (`claude/clever-pasteur-ujmu6e-m4-2`), because the menus read M4.2's `Input` (nav repeat, the pad's menu edges) rather than a second pad poller.
- **Status:** In progress.
- **Progress:** 7 of 10 steps.

## Sources, read at these commits

- **FloorFifty `apps/client/src/ui/focus-nav.ts` at `ac72660`** (249 lines) and `tests/client/ui/focus-nav.test.ts` (353):
  - `adjust` (a range input steps once, and an `input` event fires);
  - `steer` and `page`, which offer the direction to the focused element as a cancelable event before focus walks.
  - Not taken: `PAD_PRESS` (FloorFifty's unlock banner) and `data-pad-guard`. The spec's pad guard (§4.7) is a different rule: after a screen change, a confirm still held from the last screen does nothing.
- **FloorFifty `apps/client/src/ui/page-swipe.ts` at `ac72660`** (41) and its test (32): `isTap`, `releaseStep` and `WheelPager`, unchanged.
- **FloorFifty `apps/client/src/ui/back-gesture.ts` at `ac72660`** (71) and its test (102): `sendBack` and `interceptBackGesture`. The guard's history key becomes `afBackGuard`.
- **FloorFifty `apps/client/src/ui/cursor-policy.ts` at `ac72660`** (64) and its test (40): `cursorHidden` and `CursorRunner`, with `CURSOR_IDLE_MS` 2000. The screen test changes from `screen === 'Gameplay'` to `kind === 'gameplay'`.

## Scope

**In:**

- **`FocusNavigator`** (`packages/ui/src/focus/focus-nav.ts`):
  - `steer(direction)`: a spatial move inside `[data-focus-grid]` (nearest tabbable whose centre lies that way); elsewhere, up and left walk to the previous control and down and right to the next.
  - `page(delta)`: offers a cancelable `af-page` event with `{ delta }` to the focused element; a `[data-pager]` region takes it.
  - `adjust(delta)`: steps a focused range input, or checks the next radio in a focused radio group, without leaving it.
  - `guard()`: armed on a screen change. A repeating Enter or Space keydown (a key still held from the last screen) is cancelled before the browser can click the new screen's focused button. The guard ends when that key comes up.
- **The pad half of F-a** is in the menu driver (`menu-input.ts`, below): its first poll on a screen only records what is held, as `menuPad` did. `Input` itself still fires on the first poll that sees a press (M4.2's I-d timings start at 0 ms), so the guard is not put there.
- **`ScreenDef.kind?: 'menu' | 'gameplay'`** (default `menu`), in `packages/runtime/src/flow/screen.ts`.
- **Flow's focus step** (`packages/runtime/src/flow/flow.manager.ts`, step 7):
  - entering a screen focuses `[data-autofocus]`, else `[data-kind="primary"]`, else the first tabbable;
  - returning to a screen focuses the control that had focus when the player left it, if one with the same `data-testid` or `id` is there again. Screens remount on entry, so the element is matched by name, not identity.
- **One back path:** `sendBack` and `interceptBackGesture` (`packages/ui/src/focus/back-gesture.ts`). The default screens install the gesture standalone only (M4-D10); hosted, the host owns system back (R-2).
- **Cursor policy** (`packages/ui/src/focus/cursor-policy.ts`). The play screen is `kind: 'gameplay'` and runs a `CursorRunner` over its layer; a paused or menu screen never hides the pointer.
- **Menus drive the navigator through `Input`.** `packages/game/src/screens/menu-input.ts` replaces `menu-pad.ts`:
  - each nav edge steers (and moves when nothing takes it);
  - confirm, back, page and adjust go to the navigator;
  - `recover()` runs each frame.
  - The title and paused screens use it.

**Out (left to their tasks):**

- Swipe paging inside a real paged grid (`PagedGrid` is M4.6; this task ships only the helpers and `page`).
- The Settings screen (M4.4). F-b and F-c are proved on a two-screen fixture flow and on paused → play.
- Prompts (M4.4).
- The E2E matrix (M4.10).

## Interfaces

| Produced | Where | Consumers |
|---|---|---|
| `FocusNavigator.steer(direction): boolean`, `page(delta: -1 \| 1): boolean`, `adjust(delta: -1 \| 1): boolean`, `guard(): void` | `@mcthaydt/automata-ui` | game menus, M4.6 primitives |
| `isTap`, `releaseStep`, `WheelPager`, `PAGE_SWIPE` | `@mcthaydt/automata-ui` | M4.6 `PagedGrid` |
| `sendBack(doc)`, `interceptBackGesture(win, onBack)` | `@mcthaydt/automata-ui` | default screens, M4.4 Settings |
| `cursorHidden`, `CursorRunner`, `CURSOR_IDLE_MS` | `@mcthaydt/automata-ui` | play screen |
| `ScreenDef.kind` | runtime | Flow, default screens |

Consumed: `Input.onPress`, `poll(nowMs)` and the nav repeat (M4.1, M4.2), and `Hosting.kind`.

## Steps

Each step starts with a failing test whose failure reason is confirmed and recorded here, then the minimal change.

1. [x] **Plan.** This file, committed first.
2. [x] **`steer`.** Red: 4 failed, `nav.steer is not a function`; green 29 of 29. Test file: `packages/ui/src/focus/focus-nav.test.ts`.
   - Red: in a 3 × 2 `[data-focus-grid]` with stubbed `getBoundingClientRect`, `steer('down')` from the top-left cell focuses the cell below it, not the next in DOM order.
   - Red: outside a grid, `steer('right')` moves to the next control, and `steer('left')` to the previous.
   - Red: an edge cell with nothing that way returns false and keeps focus.
3. [x] **`page` and the swipe helpers.** Red: `nav.page is not a function`; `Failed to resolve import "./page-swipe"`. Green 34 of 34.
   - Red: `page(1)` returns true and delivers `{ delta: 1 }` when a `[data-pager]` ancestor cancels `af-page`, and returns false otherwise.
   - Red: the ported page-swipe cases (`page-swipe.test.ts`) fail on the missing module.
4. [x] **`adjust`.** Red: 3 failed, `nav.adjust is not a function`. Green 37 of 37.
   - Red: a focused range at 5 (step 1) reads 6 after `adjust(1)` and fires one `input` event.
   - Red: in a focused radio group, `adjust(1)` checks the next radio, fires `change`, and focus stays in the group.
   - Red: on a plain button, `adjust` returns false.
5. [x] **Pad guard (F-a), keyboard half.** Red: 2 failed, `nav.guard is not a function`. Green 39 of 39. Deviation: the pad half moved to the menu driver (step 9), because `Input` fires on the first poll that sees a press (M4.2, I-d).
   - Red (ui): after `guard()`, a repeating Enter keydown on the focused button is `defaultPrevented`. After a keyup of Enter, the next repeating Enter is not prevented.
   - The pad half is step 9's first case.
6. [x] **Focus on screen change (F-b).** Test file: `packages/runtime/src/flow/flow.test.ts` (the Flow tests live there). Red: `expected 'resume' to be 'settings'` for both the autofocus and the return case; `kind` red in typecheck (`'kind' does not exist in type 'ScreenDef<never>'`). Green: flow 23 of 23, typecheck 0 errors.
   - Red: a screen with `[data-autofocus]` on its second button focuses that button on entry.
   - Red: on a fixture flow `pause ⇄ settings`, focusing pause's `settings` button (`data-testid="settings"`), going to settings and back focuses `settings` again, not the primary.
   - Red: `ScreenDef.kind` types as `'menu' | 'gameplay'` (typecheck).
7. [x] **Back path (F-c).** Test file: `packages/ui/src/focus/back-gesture.test.ts`, the FloorFifty cases. Red: `Failed to resolve import "./back-gesture"`; green ui focus 48 of 48. In `default-screens.test.ts`, red: 3 failed (`expected false to be true` on paused, the paused screen timed out on play, `history.back` called 0 times on the title); the hosted case was confirmed red by removing the standalone check (`expected true to be false`). Green: 21 of 21. Play's back step pauses (it calls `pause` itself rather than relying on Escape reaching the Input). Deviation: the test file now disposes each test's sims in `afterEach`, because the default screens keep the sim past a shutdown on play or paused, and the added tests ran past Koota's 16 live worlds (`SimCapacityError`); that leak is 02's existing follow-up "Dispose the default screens' sim on runtime shutdown" (found in DX.2), not this task.
   - Red (`default-screens.test.ts`): standalone, a `popstate` off the guard entry on the paused screen dispatches resume and re-arms. On the title, `onBack` returns false and history steps back.
   - Red: hosted, no guard entry is pushed.
8. [ ] **Cursor policy.** Test file: `cursor-policy.test.ts`, the FloorFifty cases, keyed by `kind`.
   - Red (`default-screens.test.ts`): on play, after a keydown and with the injected clock past 2000 ms of pointer stillness, the layer's cursor is `none`. On paused it is `''`.
9. [ ] **Menus through `Input`.** Test file: `packages/game/src/screens/menu-input.test.ts`.
   - Red (F-a, pad half): with pad A held when the menu starts, its first poll clicks nothing; a fresh press after release clicks once.
   - Red: an Input stub firing `nav-down` steers or moves focus, `confirm` clicks, and `back` sends Escape.
   - Red: the held-direction repeat from M4.2 moves focus at 0, 400 and 520 ms (I-d's focus half).
   - Red: the title and paused screens no longer import `menu-pad`.
10. [ ] **Verify and record.**
    - `pnpm format`; `pnpm check` (`TURBO_FORCE=true`).
    - The CI checks-job extras, including `check-changesets` (a ui patch changeset), `api-report --update`, `pnpm cheatsheet`, `pnpm agent-skills --write`, `build` and `test:dist`.
    - `pnpm test:parity`; `CI=1 pnpm test:e2e`; `prepare-ruken` for both games.
    - Tick the M4.5 row in 02, and record the evidence and commits in 02's execution record and in 03.

## Acceptance mapping

| Case | Test |
|---|---|
| F-a | `focus-nav.test.ts` (keyboard repeat guard) and `menu-input.test.ts` (pad held at the menu's first poll) |
| F-b | `flow.test.ts` (focus restored by name on return) |
| F-c | `back-gesture.test.ts` and `default-screens.test.ts` (paused → play; the title leaves) |

## Risks

- **jsdom has no layout.** Spatial `steer` tests stub `getBoundingClientRect`; the real geometry is the E2E matrix's (M4.10).
- **jsdom's `history.back()` is asynchronous.** The back-gesture tests drive `popstate` directly, as FloorFifty's tests do.

## Execution record

| Date | Step | Commits | Evidence |
|---|---|---|---|
