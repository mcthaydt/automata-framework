# Copy table (task 8.1)

Every player-facing string of core and Emberwick, checked against the four questions of spec section 8:
**1** can she tell what is happening, **2** can she tell what to do next, **3** is it short, **4** is there no jargon.
"Kept" means it passed all four. Strings are the English defaults; a game overrides them.

## Changed

| Where | Old text | New text | Failed |
|---|---|---|---|
| Paused (default screens), the leave button, question and confirm | `Quit to title`, `Quit to title? This run is lost.`, `Quit to title` and `Cancel` | `Back to menu`, `Leave this game? Unsaved progress is lost.`, `Leave` and `Keep playing` | 4 ("title" and "run" are game-maker words) and 2 (the confirm button repeated the button just pressed; "this run is lost" was untrue for a game with saves) |
| Saves, a failed write | `Couldn't save this slot` | `Couldn't save your game. Try again.` | 4 ("slot") and 2 |
| Boot failure, a start that a retry cannot fix | `Couldn't start the game.` with no button | In Ruken or a desktop app: the same sentence and `Back to {host}`. Standalone: `Couldn't start the game. Close it and open it again.` | 2 (no next step) |
| Emberwick, paused screen | `Quit` | `Back to menu` | 1 (quit what? the app, the round?) |
| Boot failure, `damaged` (`shared/ui/status/boot-failure.ts`) | `This copy of the game is damaged.` | `This copy of the game is damaged. Download it again.` | 2 (no next step) |
| Settings, audio (`settings/settings-copy.ts`) | `Your device’s volume in the host also applies.` | `Your device’s own volume also applies.` | 4 ("the host") |
| Paused (default screens), the dialog's ✕ | `Resume` (its accessible name) | `Close` | 1 (two buttons named Resume; a screen reader cannot tell them apart) |
| Settings, a control with nothing on a device | `Unbound` | `Not set` | 4 (jargon) |
| Settings, waiting for a press | `Press a keyboard input for Jump (9 s). Escape cancels.` | `Press a new keyboard button for Jump. 9 seconds left. Escape cancels.` | 4 ("input", "s") |
| Settings, a refused rebind | `Jump can't take that: Fire needs it` | `Fire needs that one. Pick another for Jump.` | 2 (no next step) |
| Settings, audio toggle | `Mute in the background` | `Mute when you switch away` | 1 (in the background of what?) |
| Settings, audio slider | `Master` | `All sound` | 4 (jargon) |
| Settings, display | `Reduced motion: on (from your device)` | `Reduced motion is on in your device’s settings.` | 2 (where to change it) |
| Saves, a save from another version | `Saved by another version of the game; your progress will load, the rest will not` | `From another version: it loads, but some things may reset` | 3 (long) and 1 ("the rest") |
| `automata create-game`, no folder | `Error: target directory is required.` | `Error: name a folder for the game, like: automata create-game my-game` | 2 |
| `automata create-game`, bad id | `Invalid game id "X". ID must be lowercase alphanumeric with hyphens (e.g. my-game).` | `"X" can't be a game id. Use lowercase letters, digits and hyphens, like my-game.` | 4 ("alphanumeric") |
| `automata create-game`, folder taken | `Target directory "X" already exists and is not empty.` | `X already has files in it. Pick a new folder.` | 2 |
| `automata create-game`, a write failed | `Failed to write template files: …` | `Couldn't write the game's files: …` | 4 ("template") |
| `automata create-game`, done | `Created game "T" (id) at /path` | `Created "T" in my-game.` and `Next: cd my-game && pnpm install && pnpm dev` | 2 (no next step) |
| `ship prepare`, version and tag differ | `the game is at version 1.2.3 but the tag is v1.2.4` | the same, then `: tag it v1.2.3, or change the version to match` | 2 |
| `ship prepare`, entry page missing | `the entry page index.html is not in dist` | the same, then `: build the game first` | 2 |
| `ship prepare` and `publish --private`, `@pixi/3d` | `… (D-1: render-pixi3d stays private until Pixi 3D's public release) …`, `… (D-1)` | `… a closed beta that may not be shipped publicly yet …`, no decision number | 4 (an internal decision number) |
| Root `README.md`, first screen | `… web games that run inside Ruken …`, `Inside Ruken it completes the host handshake first.` | `You write a game once and ship it to the web, itch.io, Ruken or a desktop app.`, `The same build runs on its own in a browser and inside Ruken.` | 1 (Ruken is one target of four, ADR 0006) and 4 ("host handshake") |
| `tooling/consumer-smoke/README.md`, first screen | one 14-line paragraph citing `M2.4 spec §3.6`, `DX.2a`, `QB.1` | what it is for in one paragraph, then its four steps as a list | 3 (long) and 4 (plan numbers) |
| `examples/README.md` | `Art keeps to the art direction: Endesga 64.` | `… and its Endesga 64 colour palette.` | 4 (a palette's name alone) |

## Kept, with the reason

| Where | Text | Why it passes |
|---|---|---|
| Emberwick splash | `Press any key or tap` | Says what to do. |
| Emberwick splash mark | `AutomataFramework` | A credit line, not an instruction. |
| Emberwick menu | `Emberwick`, `Carry your lantern up to the ember.`, `Play`, `← → move  Space jump  Esc pause` | One idea each; one big button. |
| Emberwick end | `The ember is yours`, `Play again`, `Menu` | Says what happened and the two choices. |
| Emberwick pause (touch) | `Pause` (a button) | Named by role. |
| Paused (default screens) | `Paused`, `Resume`, `Back`, `Mute`, `Unmute`, `Settings` | One to three words. |
| Leave confirm | `Leave this game? Unsaved progress is lost.`, `Leave`, `Keep playing` | Says what is lost, and the two buttons say what each does. |
| Controller | `Reconnect your controller` | Says what to do. |
| Saves | `Saving…`, `Progress saved`, `Empty`, `Continue`, `New game`, `Delete this save?`, `Keep it` | Plain words. |
| Saves, failure | `Couldn't save your game. Try again.`, `This save can't be opened`, `Could not save yet; trying again` | Say what happened and, where it matters, that it retries. |
| Boot failure | `Couldn't start the game.`, `Couldn't start the game. Close it and open it again.`, `Couldn't connect to Ruken.`, `Couldn't load your progress.`, `This device can't run the game.`, `Still waiting for the game to download.` and `Try again`, `Continue without loading`, `Back to {host}` | One sentence plus a button that fixes the usual cause. `connect` only shows when the host is Ruken. |
| Scores | `Loading scores…`, `No scores yet`, `You're offline` | Plain words. |

## Checked and kept

- The Settings tab names, `Controls`, `Keyboard`, `Controller`, `Touch`, `In use`, `Reset controls`, `Press…`, the
  pad's button names, `Change Jump on Keyboard`, `That one is kept for menus. Pick another for Jump.`,
  `Nothing was pressed. Jump is unchanged.`, `Jump saved`, `Rumble and vibration`, `Play with`, `Buttons`, `Swipe`,
  `Graphics quality`, `High`/`Medium`/`Low` and `Automatic`: short, and say what they are.
- Language names are each language's own name for itself (`endonymOf`), which is what a speaker looks for.
- The other `automata` usage lines, `ship` errors (secrets, root-absolute paths, boards, orientation, inputs,
  `ruken publish` exits) and `--targets` errors: they say what is wrong and what to change. They are for game
  authors, so names like `ship.config.ts` stay.
