## Summary

M4.3 touch buttons and gestures ([plan](docs/superpowers/plans/2026-10-17-m4-3-touch-gestures.md); M4 spec §4.4, §6; acceptance I-f). From `main`; the first commit is the TDD plan. Ported from FloorFifty `swipe-tracker.ts`, `touch-controls.ts`, `TouchControls.svelte` and `SwipeSurface.svelte` at `ac72660`, with their tests; The Last Light's `swipeTurn` (`17eb568`) read and mapped to the press edge of a held swipe.

- **`SwipeTracker` (runtime):**
  - FloorFifty's floating anchor on both axes: `swipe-left/right/up/down` are held while the first steering finger is past the dead zone;
  - `flick-down` pulses for 40 px down within 180 ms, by any finger (I-f: 39 px, or 181 ms, does not);
  - tuning defaults are FloorFifty's (`deadZonePx` 12, `saturationPx` 48, `flickPx` 40, `flickMs` 180);
  - times are `PointerEvent.timeStamp`, passed in.
  - **`tap` is AF's own rule, for review:** a finger lifted within `flickMs` that never left the dead zone. Neither source defines a tap.
- **Bindings:** `actionsForGesture`, `TouchMode` and `touchModesFor`.
- **`Input.gesture`:** a held gesture holds its actions as touch; a pulse is latched for exactly one sample (`poll()` then `held()`), so a flick between steps is never lost (FloorFifty's latch). Two sets swapped per poll; nothing allocated per step.
- **ui `TouchControls`:** sticky buttons (24 px margin, a thumb slides between buttons, several thumbs at once), captured per side, page gestures cancelled, at least 48 px, out of the focus order, hidden with `hidden` (no remount) and releasing on hide and unmount.
- **ui `SwipeSurface`:** forwards each finger with its timestamp, lifts per finger on cancel or lost capture, `steers(x, y)` for the game's rule, draws the thumb-to-anchor line.
- **Game lane:** `keys(…, { gestures, touchMode })`, `InputMap.touchMode`, `InputSource.gesture`. The default play screen uses `TouchControls` (mode `buttons`) or a `SwipeSurface` over a `SwipeTracker` (mode `swipe`). Its buttons keep their look (centred, 1.5 × primary).
- **Example:** `core/core-input-touch.ts`.
- **Changeset:** ui patch.
- **Goldens:** unchanged.

## Gates (local, `TURBO_FORCE=true`)

| Gate | Result |
|---|---|
| `pnpm format` | clean |
| `pnpm check` | 30 of 30 tasks, first attempt |
| CI extras (`pnpm build`, `api-index`, `build:examples`, changesets) | passed, first attempt |
| `pnpm test:parity` | 11 of 11 tasks (ui 378 cases, touch layout 75 of 75 in three engines) |
| `CI=1 pnpm test:e2e` | 74 passed, 2 skipped |
| `prepare-ruken` (placeholder, Emberwick) | passed |

Omitted: none. Pending: hosted CI on this head.

**Owner acceptance, not claimed:** a real phone plays `core-input-touch` and Emberwick with the buttons and the swipe surface (near misses, two thumbs, a flick while steering), with the device, browser and date recorded.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
