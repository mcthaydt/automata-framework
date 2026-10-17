## Summary

M4.5 focus navigation, back gesture and cursor policy ([plan](docs/superpowers/plans/2026-10-17-m4-5-focus-back-cursor.md); M4 spec §4.7; M4-D10; acceptance F-a, F-b, F-c). Built on M4.2: the menus read its `Input` and its nav repeat. The first commit is the TDD plan.

- **`FocusNavigator`** (ui), ported from FloorFifty `focus-nav.ts` at `ac72660`:
  - spatial `steer` inside `[data-focus-grid]`, linear order elsewhere;
  - `page` and `adjust`, plus `WheelPager`, `PAGE_SWIPE`, `isTap` and `releaseStep` from `page-swipe.ts`;
  - `guard()`: a key already held when a menu opens does nothing until it is released (F-a, keyboard half).
- **Flow (runtime):** focus is restored by name when a screen comes back (F-b); `ScreenDef.kind` is `'menu'` or `'gameplay'`.
- **Back gesture (ui):** `interceptBackGesture` and `sendBack`. Standalone only: hosted runs add no history entry (M4-D10). Paused goes to play, play pauses, and the title leaves (F-c).
- **Cursor policy (ui):** `CursorRunner` and `cursorHidden`. In gameplay the cursor hides after 2 s of pointer stillness or on a key or pad input; menus always show it.
- **Menus through `Input` (game):** `menuInput` replaces `menu-pad.ts`, which is deleted. Pad confirm and back come from `Input`. Keyboard Enter, Space and Escape stay with the browser and the screens' listeners, so nothing fires twice. A pad button held when a menu opens is ignored (F-a, pad half).
- **Changeset:** ui patch. Its `BREAKING:` line is there because the API report counts `FocusNavigator`'s added methods as a changed class; every existing call behaves as before.
- **Test harness deviation:** `default-screens.test.ts` disposes the sims it starts. The default screens leak a sim when the runtime shuts down mid-play, which hits Koota's 16-world cap; this is 02's existing follow-up row 53.
- **Unchanged goldens:** Emberwick and every example.

## Gates (local, `TURBO_FORCE=true`)

| Gate | Result |
|---|---|
| `pnpm format` | Clean |
| `pnpm check` | Passed, 30 of 30 |
| CI checks-job extras | Passed (changeset status, `check-changesets`, `build:examples`, `api-report`, `build`, `test:dist`, `api-index`, `agent-skills`, demos, size budget) |
| `pnpm test:parity` | Passed, 11 of 11 |
| `CI=1 pnpm test:e2e` | 74 passed, 2 skipped |
| `prepare-ruken` | Passed for Emberwick and the placeholder |

**Owner acceptance, not claimed:** back swipes and pad menus on real phones and controllers (M4.10, spec §13).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
