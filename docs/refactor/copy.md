# Copy table (task 8.1)

Every player-facing string of core and Emberwick, checked against the four questions of spec section 8:
**1** can she tell what is happening, **2** can she tell what to do next, **3** is it short, **4** is there no jargon.
"Kept" means it passed all four. Strings are the English defaults; a game overrides them.

## Changed

| Where | Old text | New text | Failed |
|---|---|---|---|
| Emberwick, paused screen | `Quit` | `Back to menu` | 1 (quit what? the app, the round?) |
| Boot failure, `damaged` (`shared/ui/status/boot-failure.ts`) | `This copy of the game is damaged.` | `This copy of the game is damaged. Download it again.` | 2 (no next step) |
| Settings, audio (`settings/settings-copy.ts`) | `Your device’s volume in the host also applies.` | `Your device’s own volume also applies.` | 4 ("the host") |

## Kept, with the reason

| Where | Text | Why it passes |
|---|---|---|
| Emberwick splash | `Press any key or tap` | Says what to do. |
| Emberwick splash mark | `AutomataFramework` | A credit line, not an instruction. |
| Emberwick menu | `Emberwick`, `Carry your lantern up to the ember.`, `Play`, `← → move  Space jump  Esc pause` | One idea each; one big button. |
| Emberwick end | `The ember is yours`, `Play again`, `Menu` | Says what happened and the two choices. |
| Emberwick pause (touch) | `Pause` (a button) | Named by role. |
| Paused (default screens) | `Paused`, `Resume`, `Back`, `Mute`, `Unmute`, `Settings` | One to three words. |
| Quit confirm | `Quit to title? This run is lost.`, `Quit to title`, `Cancel` | Says what is lost. |
| Controller | `Reconnect your controller` | Says what to do. |
| Saves | `Saving…`, `Progress saved`, `Empty`, `Continue`, `New game`, `Delete this save?`, `Keep it` | Plain words. |
| Saves, failure | `Couldn't save this slot`, `This save can't be opened`, `Could not save yet; trying again` | Say what happened and, where it matters, that it retries. |
| Boot failure | `Couldn't start the game.`, `Couldn't connect to Ruken.`, `Couldn't load your progress.`, `This device can't run the game.`, `Still waiting for the game to download.` and `Try again`, `Continue without loading`, `Back to {host}` | One sentence plus a button that fixes the usual cause. `connect` only shows when the host is Ruken. |
| Scores | `Loading scores…`, `No scores yet`, `You're offline` | Plain words. |

## Not yet checked

- The Settings screen's longer strings (controls, touch and display sections) and the language names.
- `automata create-game` and `ship prepare` messages, and the first screen of each package README.
- `Saved by another version of the game; your progress will load, the rest will not` is long (question 3) and
  left for the copy pass on the saves screen.
