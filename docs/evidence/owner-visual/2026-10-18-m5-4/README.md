# M5.4 Audio group: AF beside FloorFifty

For the Desk first (Owner standing rule, 2026-10-18).

- **AF** (`af/`): this branch, `core/input-rebind` standalone. Captures: Paused, then the Settings tab and the Controls tab, at 390x844, 844x390, 780x270, 820x1180 (touch) and 1280x720. Captured as in the redo's README.
- **FloorFifty**: `../2026-10-18-redo/floorfifty/ff-settings-<size>.png` and `ff-paused-<size>.png` (`a28dc44`), whose Settings tab has the Audio group beside Language.

## What matches

- Audio is a group on the Settings tab, set beside the first group on a wide dialog and under it on an upright phone.
- Its order: Mute, Mute in the background, then one row per volume (name, slider, percentage).
- Every change applies and saves at once.
- Pause: Resume, Mute, Settings and the leave action, two by two from a 340 px dialog, as FloorFifty's.

## Where AF differs, and why

- **Five volumes, not two.** AF's buses are master, music, effects, menus and voices (M5 spec §4.6, M5-D3), where FloorFifty has music and effects.
- **No Language group yet.** It comes from PRODUCT.L and the endonyms follow-up, so Display sits where FloorFifty's Language does.
- **No rumble.** It is not in AF's core.
- **Toggles are AF's switch rows** (the M4.6 `Toggle`) rather than plain checkboxes: that is look, not layout.
