# Settings and Pause redo, second round: AF beside FloorFifty, over a game frame

For the Desk first (Owner standing rule, 2026-10-18). This round folds in the Desk's review and the Owner's rulings:
- the Language, Audio and Vibration groups;
- a phone-height sheet;
- shots taken over a real-looking game frame.

- **AF** (`af/`), this branch:
  - `core/input-rebind` standalone: play, Escape, then Settings and its Controls tab.
  - Sizes: 390x844, 844x390, 780x270, 820x1180 (touch, as a mobile browser) and 1280x720.
  - **The backdrop is a frame of Emberwick's room** (`games/emberwick`, captured at the same size). The example's own canvas, a square on black, is hidden for the shot, so the dim over a real scene can be judged. The dialogs are live; only the scene behind them is the picture.
- **FloorFifty** (`a28dc44`): `../2026-10-18-redo/floorfifty/ff-{paused,settings,controls}-<size>.png`, plus the gate and the toast.

## What changed since the first round

- **Settings groups, in FloorFifty's order:**
  - Language: Automatic, then each language by its endonym.
  - Audio: Mute, Mute in the background, a row per volume; a released slider plays a sample on its bus.
  - Vibration: one toggle, shown only where the device can rumble or buzz.
  - Display.
  - Touch controls (coarse pointer, both modes).
  - On a wide dialog the groups go two across, Language beside Audio.
- **Phone sheet:** on a phone, Settings fills the band's height. The list takes the rest and shows "+N more"; Back is at the bottom.
- **Pause:** Resume, Mute, Settings and Quit to title, two by two, as FloorFifty's.
- **Rotate hint:** `rotateHint: 'block' | 'toast'`, `'block'` by default. `'toast'` is FloorFifty's dismissible message.

## Where AF still differs

- **Languages are shown by endonym in words, not flags.** FloorFifty's flags are its own art. A game with one language shows Automatic and that language.
- **Five volumes** (master, music, effects, menus, voices), where FloorFifty has three.
- **Back under Settings** is left out on short and compact bands, where the dialog's Close (named Back) does the same.
- **The toast's dismissal lasts the session.** FloorFifty saves it on the device; AF would need device storage outside `Hosting`.
