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
| A new game's release workflow, no itch.io key (task 15.1) | (new) | `No BUTLER_API_KEY secret yet, so nothing was published to itch.io.` | (new; says what happened and names the one thing to add) |
| `ship prepare`, version and tag differ | `the game is at version 1.2.3 but the tag is v1.2.4` | the same, then `: tag it v1.2.3, or change the version to match` | 2 |
| `ship prepare`, entry page missing | `the entry page index.html is not in dist` | the same, then `: build the game first` | 2 |
| `ship prepare` and `publish --private`, `@pixi/3d` | `… (D-1: render-pixi3d stays private until Pixi 3D's public release) …`, `… (D-1)` | `… a closed beta that may not be shipped publicly yet …`, no decision number | 4 (an internal decision number) |
| Root `README.md`, first screen | `… web games that run inside Ruken …`, `Inside Ruken it completes the host handshake first.` | `You write a game once and ship it to the web, itch.io, Ruken or a desktop app.`, `The same build runs on its own in a browser and inside Ruken.` | 1 (Ruken is one target of four, ADR 0006) and 4 ("host handshake") |
| `tooling/consumer-smoke/README.md`, first screen | one 14-line paragraph citing `M2.4 spec §3.6`, `DX.2a`, `QB.1` | what it is for in one paragraph, then its four steps as a list | 3 (long) and 4 (plan numbers) |
| `examples/README.md` | `Art keeps to the art direction: Endesga 64.` | `… and its Endesga 64 colour palette.` | 4 (a palette's name alone) |
| Editor Home, the storage line on a checkout | `Kept in your game’s checkout, on the computer running automata editor` | `Saved in your game folder` | 3 (long) and 4 ("checkout") |
| Editor Share, on a checkout whose Save writes the game files | `Open a game folder to write into it.` | Nothing: the button is not offered; `Save already writes your game’s files into content.` | 2 (a folder to open was never needed) |
| `automata check --help`, the drift step | (new) | `levels  a level and the game files saved from it match (for a game whose editor list sets exports)`; and a finding says `content/levels/room-1.toml does not match content/rooms/room-1.af2d.json. Open the level in the editor and press Save.` | 2 (it names the file and the button) |
| `automata editor --help`, first line | `Opens an editor on the game in <folder>` | `Opens the level editor on the game in <folder>` | 1 (which editor?) |
| `automata editor --app 3d`, in a published copy | (a missing-build error about pnpm) | `The 3D editor is not in this release yet.` | 2 (the pnpm line is for the repository's developers) |
| `automata editor --help`, with no editor list | `(or the .json files, if there is none)` | `Without content/editors.toml, it opens only level files (*.af2d.json).` | 1 (which .json files?) |
| Editor Home, the title and the list | `Projects`, `3 in this workspace`, `Search projects` | `Your levels`, (no count), `Search levels` | 4 ("project", "workspace": every card is a level) |
| Editor Home, where the levels come from | `OPEN FROM · This workspace · 1 project · game checkout` | `Your game: Emberwick` under the title (on a game folder), and `Open from`: `This game` or `This browser`, `Import files` | 4 ("workspace", "checkout") and 1 (whose files?) |
| Editor Home, the storage notes | `Autosave on` · `Saved in your game folder` · `Edits are autosaved beside your projects, so a crash does not lose them.` | `Saved in your game folder. Edits are kept if the page closes.` (in a browser: `Saved in this browser. …`; nothing kept: `Not saved on this device. Download your level to keep it.`, the browser's reason as its tooltip) | 3 (three lines for one fact) and 4 ("autosave") |
| Editor Home, a card | `Level project` · `3.2 KB · 7 min ago` · `content/rooms/room-1.af2d.json` | `Changed 7 minutes ago`; the kind, file, size and date are under More, Details | 4 (format and file words on the first screen) and 3 |
| Editor Home, the card's actions | a third column with `Open`, `Duplicate`, `Delete` | the card opens on a tap; its More menu holds `Open`, `Duplicate`, `Details`, `Delete…` | 2 (the actions were in a column she had to find) |
| Editor Home, making a level | the `Start a new project` cards under the list | `New level` (the top bar's primary button) opens a sheet: `New level`, `Pick a starting point. You can change everything later.` | 4 ("project") and 2 (the cards were below every level) |
| Editor Home, no levels | `No projects yet` · `Pick a template below to start one.` | `No levels yet` · `Make your first one to start drawing.` and a `New level` button | 4 and 2 (the templates were elsewhere) |
| Editor Home, a new level on a game folder | `untitled-platformer.af2d.json: untitled-platformer.af2d.json is not one the editor may write` | the level is made in the folder the game keeps its levels in (`content/rooms/`); with no such folder: `Your game has no folder for new levels yet. Add one to content/editors.toml, then try again.` | 1, 2 and 3 (it named the file twice and never said what to do) |
| Editor Home, Delete on a game folder | `This level is deleted for good. You can’t undo this.` | `It’s removed from your game for good. You can’t undo this.` | 1 (on a game folder it leaves the game) |
| Editor, Back with unsaved changes | (left at once; the autosave kept the edits for a restore offer next time) | `Save your changes to Mossgate?` · `If you don’t save, your changes since the last save are lost.` · `Cancel`, `Don’t save`, `Save` | 1 (leaving silently looked like losing the work) |
| Editor, the top bar and the status bar | the name over `levels/mossgate.af2d.json`, a `Level project` pill; `Undo`, `Redo`, `Save` as text buttons; a status bar with `Saved` / `Unsaved changes` / `Saving…` / `Save failed` / `Not saved on this device` | the name alone; Undo and Redo as icons named with their step; Save, the one primary button: `Save`, `Saving…`, `Saved`; no status bar | 4 (path and format words) and 3 (the state said twice) |
| Editor, the views | a side rail: `Level`, `World`, `Tilesets`, `Entities`, `Checks`, `Export` | a switcher in the top bar: `Level`, `Map`, `Tiles`, `Characters` (a menu named after the open view on a phone) | 4 ("Tilesets", "Entities": format words) and 1 (Checks and Export were not places to go) |
| Editor, problems | the `Checks` view: `Errors (2)`, `Warnings (1)`, `Info (1)`, `Locate`, `No problems` | `2 problems` in the top bar (nothing when there are none); a `Problems` sheet: `Needs fixing (2)`, `Worth a look (1)`, `Show`, `Done`; notes (a level with nothing in it yet, a character nothing uses) are not counted | 4 ("Errors", "Info", "Locate") and 3 (a fresh level said it had problems) |
| Editor, Share (browser storage only) | the `Export` view: `Project file` and `Game files` cards with sizes, `Download`, `Share`, `Copy`, `Write to folder`, `Downloaded 3 files.` | a `Share` menu: `Download`, `Share` (off with `This device can't share files.`), `Copy`; toasts `Downloaded your level.`, `Shared your level.`, `Copied your level. Paste it anywhere to keep it.` | 4 (file sizes, "Project file") and 1 (on a game folder Save already writes the game) |
| Editor, rename | (no way to rename a level) | tap the name: `Rename` · `Name` · `Cancel`, `Rename` | 2 (no way to fix a name) |
| Editor, Map, Tiles and Characters, below a wide screen | a row of text buttons above the stage: `Levels` / `Rules` / `Definitions`, `Details`, `Fit` | one pill floating over the stage, as the Level view's tools: `All levels` / `All tiles` / `All characters`, `Details`, and on the Map an icon button `Fit the map in view` | 4 ("Rules", "Definitions") and 2 (the pill sits where the Level view's does) |
| Editor, the inspector's tabs | Level view: `Entity`, `Level`, `Checks`; Characters: `Definition`, `Fields 3` | `Selected`, `Level`, `Problems`; `Character`, `Settings 3` | 4 ("Entity", "Definition", "Fields") |
| Editor, Characters with the level settings chosen | `Every level carries these fields (3 levels); the Level view’s Level tab edits their values.` | `Every level has these settings (3 levels). To change them for one level, open it in the Level view and tap Details.` | 4 ("fields") and 2 (where to go) |
| Editor, a game with no tiles or characters | `This document has no tilesets to show` · `This document has no entity definitions to show` | `This game has no tiles to show` · `This game has no characters to show` | 4 |
| Editor, the save conflict | `mossgate.af2d.json changed since you opened it` · `Something else wrote the file after it was opened here. Nothing was overwritten. Keep mine writes your edits over it, Take theirs reloads the file and drops your edits, and Save as copy keeps both.` · `Cancel`, `Take theirs`, `Keep mine`, `Save as copy` | `Mossgate was changed somewhere else` · `It was saved from another place while you worked on it here. Nothing has been overwritten. Keep both saves your changes as a copy, Use mine saves over the other version, and Use theirs throws your changes away.` · `Cancel`, `Use theirs`, `Use mine`, `Keep both` (the one primary) | 4 (a file name) and 1 ("theirs" of what?) |
| Editor, the restore offer | `Restore your unsaved work?` · `This file has edits that were never saved. The autosave kept them as they were made.` · `File`, `Last autosave`, `File on disk: Unchanged since the autosave began` · `Discard`, `Restore edits`; Undo `Restore autosave` | `Keep your changes from last time?` · `You changed Mossgate 7 min ago and didn’t save. Your changes were kept.` (and, when it changed elsewhere too, `Mossgate was also changed somewhere else since then. Keeping your changes replaces that.`) · `Throw away`, `Keep my changes`; Undo `Keep changes from last time` | 4 ("autosave", "on disk", a file name) |
| Suite Home, the card of an editor this build does not have | `Feel isn't in this build. It comes with the Plus editors (editor-plus). Its files open read only.` | `Feel isn't in this build. Its files open read only.` | 4 ("Plus", a package name) and 2 (there is no such package to get) |
| Suite rail | nine tabs: `Tuner`, `Studio`, `Audio`, `Feel`, `Writer`, `Schematic`, `Sequence`, `Levels`, `Review` | the page's editors, by their own names (`Tuner`, `Levels 2D`), and `Review` when there are change sets | 1 (seven of the nine opened nothing) |
| Suite import, a section for an editor this build does not have | `editor not installed (editor-plus)` | `editor not installed` | 4 (a package name) |
| Suite page, served by `automata editor` | `Sample game` in the top bar, always | the game's own files; `Sample game` only when no editor server answers | 1 (it said sample on a real game) |
| Suite top bar, the title | `Editors` | the game's name (`Emberwick`), `Sample game` on the sample | 1 (it named the tool, not the game) |
| Suite top bar, on a game folder | (nothing) | `Saved in your game folder` | 3 (where did my change go?) |
| Suite top bar, the pills with nothing to say | `No change set` · `No checks run` · `Gates not readable` | not shown until they mean something | 1 and 4 ("change set", "gates") |
| Suite top bar, Undo and Redo | `↶` · `↷` | icon buttons named `Undo` · `Redo`, with the step they take (`Undo Edit`) (session 19) | 1 |
| Suite top bar, Home (session 19) | `Home` (a boxed word) | a house icon named `Home` | 4 (the word boxed beside the name read as a second title) |
| Suite top bar, Publish with nothing to publish (session 19) | the lime `Publish` | a plain `Publish`; its dialog says `Nothing new to publish yet.` | 2 (the primary pointed at something that does nothing) |
| Suite Export (session 19) | `Format` (two radios) · `Exported document` · `Close` | `Format` (`TOML`, `JSON`) · `Your game as text` · `Copy` (the primary) and `Close` · `Copied. Paste it anywhere to keep it.` · `Couldn't copy. Select the text and copy it.` | 3 (what do I do with this?) |
| Suite Import (session 19) | `Document to import` · `Plan` · `Plan again` · `Apply` · `content/tuning.toml` · `No gates` · `Checks: content, content-check` · `Reopens g-feel` · `Refused` · `… changed since the plan.` · `Imported as one step; Undo takes it back.` · `Nothing was imported: no change set was started.` | `Paste the text to import` · `See changes` · `See changes again` · `Import` · `Tuning` · (not shown) · (not shown) · `Needs review again: g-feel` · `Can't import` · `Tuning changed since you looked. See the changes again.` · `Imported. Undo takes it back.` · `Nothing was imported.` | 1 and 4 (plan, apply, gates, checks, paths) |
| Characters inspector, the Settings tab (session 19) | `Settings 0` · `Fields of Coin` | `Settings` (`Settings (2)` with a count) · `Settings of Coin` | 1 ("Settings 0" read as a setting named 0) |
| Characters inspector, the Settings tab (session 20) | `Add field` · type chips `int`, `float`, `bool`, `text`, `enum`, `color`, `angle`, `ref`, `point` · `No fields yet.` | `Add setting` · `Whole number`, `Number`, `Yes or no`, `Words`, `One of a list`, `Colour`, `Angle`, `Link to a thing`, `Spot` · `No settings yet.` | 4 (format words), 1 (the tab says Settings, the button said field) |
| Level view, a layer row (session 20) | `Characters` over `Characters and items` | `Characters` alone; the kind shows only when the name does not already say it (`Collision` over `Walls and floors`) | 1 (said one thing twice) |
| Choosing a link's target, and the view still to come (session 20) | `Nothing in the project can be its target.` · `Your project is safe.` | `Nothing in this game can be its target.` · `Your game is safe.` | 4 ("project") |
| Tuner, a value (session 19) | `384` (subpixels a tick) · `MAX_RUN: 9000 is past the largest it may be, 768` · `Range 128 to 768, step 1` · `whole number` | `90 px/s` · `Running speed: … is past the largest it may be, 180 px/s` and `Must be at most 180 px/s` · `Range 30 to 180 px/s` · `number` | 2 (a number no player can feel) |
| Tuner, Emberwick's feels (session 19) | `How hard Wick jumps. Further below zero jumps higher.` · `… (60 is one second).` | `How hard Wick jumps.` · the value in seconds | 2 |
| Level view, the templates' characters layer (session 19) | `Entities` · `Paint with · Entities` | `Characters` · `Paint with · Characters` | 4 (a format word) |
| Home, a level's Details (session 19) | `Entities: 6 definitions` · `Tilesets: 1 placeholder` | `Characters: 6` · `Tiles: 1 placeholder` | 4 |
| The editor guide's title (session 19) | `Edit a game's levels with the editors` | `Draw levels in the editor` | 1 |
| Suite Home, the sample | a small `Sample game` chip | `This is a sample game, not yours. Run automata editor inside your game's folder to edit it.` | 3 (why can't I find my game?) |
| Tuner, the game pane | (none) | `Your game` (the frame's name) · `Start your game with pnpm dev to see your changes here.` · `Your game shows here when you open the editors in your game's folder.` | new |
| `automata editor --help` | (none) | `The Tuner shows your game beside its settings: start it with pnpm dev, and give --game-url if it is not on http://localhost:5173.` · `--game-url is a web address, like http://localhost:5173` | new |
| Tiles, Add tiles (12.3b) | (none) | `Add tiles` (the panel's button, the empty screen's primary and the dialog's title and primary) · `Choose a picture` / `Choose another picture` · `How big is one tile?` · `Tile size` · `8 px` `16 px` `32 px` `48 px` · `This makes 64 tiles.` · `The picture is 100 px wide; 16 px tiles leave 4 px over. Try 10 or 20.` · `The picture is 32 px wide, smaller than one 48 px tile.` · `That file isn’t a picture we can read. Try a PNG, WebP or JPEG.` · `Couldn't add the picture: {why}` | new (no format word, path or "tileset" on screen; the picture's own name shows without its type) |
| Tiles, the picture's line and badge (12.4 Step G, session 18) | `16 × 16 px tiles · spacing 0 · padding 0 · 8 × 8 tiles` · `placeholder · generated` | `64 tiles, each 16 × 16 px` (`, 2 px apart`, `, 1 px from the edge` only when there are any) · `Stand-in tiles` | 4 (spacing, padding, generated) |
| Tiles, the live preview and the rule's place | `IntGrid · Collision · Solid` · `Result · Ground` · `Ground · seed 1` · `rule 1` | `Where you paint Solid on Collision` · `The tiles Ground places` · `Ground` · `No. 1 in this group` | 4 (IntGrid, seed) |
| Characters, how many are placed | `no instances` · `3 instances · 1 level` | `Not in any level yet` · `3 placed in 1 level` | 4 (instance) |
| Tiles and Characters, the panels' headings | `Tilesets` · `Definitions` | `Your tiles` · `Characters` | 4 |
| Characters panel (session 18) | `Add entity` (and its undo step) · `No entity definitions yet.` · `Add level field` · `Settings for every level` / `music · …` (the row) | `Add character` · `No characters yet. Add one to place it in your levels.` · `Add a level setting` · `Every level` / the settings' names, with commas | 4 (entity, definition, field) and 1 (the row repeated its heading) |

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
| `automata --help` | Thirty lines: exit codes, `D-1`, `__AUTOMATA_DEBUG__`, kit commands, every option of every command | Seven lines: one for each command, then `Run automata <command> --help for more.` | 3 (long) and 4 (codes, constants) |
| `automata check --help` | `(exit 0 pass, 1 findings, 2 a tool could not run)` inside a paragraph, steps named but not explained | Each step in one plain line (`test  the game's own tests pass`), the options, and `Exit status:` last | 1 and 4 |
| `automata ship --help` | `prepare` wrote `ruken.toml` for a Ruken game without being asked; `(D-1)`; `@tauri-apps/cli` | `Every command names its target.`, one line per target, no package names | 2 and 4 |
| `automata editor --help` | `It listens on the loopback only` | `Only this computer can open it, unless you add --lan` | 4 ("loopback") |
| `automata build`, done with `--debug` | `built with the debug constant on` | `built with the developer tools in` | 4 ("constant") |
| `automata ship prepare` or `publish`, no `--target` | Built for Ruken without being asked | `Choose a target: --target web, itch, tauri or ruken.` (`itch or ruken` for publish) | 2 (what to type) |
| `automata ship publish --target web` | `publish has no web target` | `There is nothing to publish for web. After prepare --target web, upload the dist folder to any static host.` | 2 |
| `automata ship prepare --target web`, done | (new) | `checked 12 files in dist; upload the folder to any static host` | 2 |
| `automata <anything else>` | Made a game in a folder of that name | `Unknown command "add".` and the help | 1 |
| `automata create-game --help`, targets | `--targets <list>   web,itch,ruken,tauri` | `--targets <list>   default: web,itch; also tauri, ruken` | 2 (which are on by default?) |
| `automata create-game`, the new game's README | Pointed at repository paths and GitHub links for the publish guides | Starts with `pnpm dev`, says where things are, and names the Docs on the Automata Framework site for each target's steps | 2 (a stranger has no repository to open) and 4 ("scaffold") |
| `@mcthaydt/automata-tools` README | Began with repository setup | Begins with `pnpm dlx @mcthaydt/automata-tools create-game my-game` | 2 |

## Checked and kept

- The Settings tab names, `Controls`, `Keyboard`, `Controller`, `Touch`, `In use`, `Reset controls`, `Press…`, the
  pad's button names, `Change Jump on Keyboard`, `That one is kept for menus. Pick another for Jump.`,
  `Nothing was pressed. Jump is unchanged.`, `Jump saved`, `Rumble and vibration`, `Play with`, `Buttons`, `Swipe`,
  `Graphics quality`, `High`/`Medium`/`Low` and `Automatic`: short, and say what they are.
- Language names are each language's own name for itself (`endonymOf`), which is what a speaker looks for.
- The other `automata` usage lines, `ship` errors (secrets, root-absolute paths, boards, orientation, inputs,
  `ruken publish` exits) and `--targets` errors: they say what is wrong and what to change. They are for game
  authors, so names like `ship.config.ts` stay.

## Site and the CLI's editor and check output (task 20.1, 2026-11-07)

Every visible string of the seven pages (Home, Start, Editor, Docs, Examples, API, the 404) was listed from the built
HTML, plus the search dialog, the demo's controls, the playground's messages, the guides the docs show and the CLI's
editor and check output. The [grandma audit](2026-11-06-grandma-ux-copy-audit.md)'s section 4 rows were applied where
the string still exists; rows whose string phase 18 already removed are under "Gone before this pass".

### Changed

| Where | Old text | New text | Failed |
|---|---|---|---|
| Demo controls (while playing) | `Restart` · `Fullscreen` · `Open demo` · `Stop demo` (with the labels "Restart demo", "Toggle fullscreen") | `Start over` · `Full screen` · `Open in a new tab` · `Stop` (the visible words are the names) | 4 ("demo", "toggle"); the label did not match the word |
| Demo, full screen refused | `Fullscreen is unavailable. Open the demo in a new tab.` | `Full screen isn't available here. Try Open in a new tab.` | 2 (names the button to press) |
| Demo, full screen silent | `Fullscreen did not start. Open the demo in a new tab.` | `Full screen didn't start. Try Open in a new tab.` | 2 |
| Demo, no script | `JavaScript is required for the embedded controls. Open the standalone demo.` | `Playing here needs JavaScript. Open the game on its own page.` | 4 ("embedded", "standalone") |
| Search title | `Find your way` | `Search` | 1 |
| Search placeholder | `Try createSim or snapshot` | `Search, e.g. jump, save, level` | 4 (API names) |
| Search, nothing found | `No matches. Try a function name or topic.` | `Nothing found. Try another word.` | 4 ("function") |
| Search order | pages, examples (as `id: title`), guides, API | pages, guides, examples (their title; the id still matches), API | a plain question met an example id first |
| Examples lead and "How an example runs" | `One file each. Open an example and it runs beside its code.` and a paragraph on preview frames, compile errors at a line and column, and Restart | `Small games, one file each. Open one and change its code: the game beside it updates as you type.` (the paragraph is gone) | 3 (long) and 4 ("preview frame", "compiled") |
| Example titles (17, from each file's first line) | lowercase fragments in engine words: `a chime on a sim event`, `the sim stands still while the host has the game in the background`, `a square drawn between sim ticks…`, `sprites drawn from a packed atlas` | sentences that say what you see: `A chime that plays when the game says so`, `The game stops and pauses while its tab is in the background`, `A square that moves smoothly between the game's steps`, `Pictures cut from one packed image` (all 17 in `examples/README.md`) | 4 ("sim", "tick", "host", "atlas") |
| Playground, not a game | `The example's default export must be defineGame(...)` | `This code doesn't make a game any more. Press Reset to start again` | 2 and 4 |
| Playground, live updates off | `Live updates are unavailable in this browser. Play still runs the original.` | `This browser can't update the game as you type. Press Play to see the original.` | 2 |
| Playground, the determinism row | shown under every preview (`these 120 ticks replay … Hash 9ea9…`) | folded under `For developers`; it opens itself when the hashes differ (a bug to report) | 4 (for developers only) |
| Start, agent setup | `Prepare your agent.`; `Use Superpowers for the development workflow and the official PixiJS v8 skills for rendering guidance…`; `Run this in the game checkout…`; `Ask your agent to verify readiness`; `Skill preflight to copy`; `Confirm the preflight result`; `3 of 3 confirmed by you. Your agent preflight is complete.`; `This page cannot inspect another app's installed skills. These confirmations record your preflight check, not automatic detection…` | `Set up your agent once.`; `Give your agent two sets of skills: Superpowers, which plans and tests each change, and PixiJS, which knows how the game draws.`; `Run this in your game's folder, pick your agent when it asks, and install the whole PixiJS collection.`; `Ask your agent to check`; `Copy this to your agent`; `What your agent said`; `3 of 3 ticked. Your agent is ready.`; `This page can't see what your agent has installed, and nothing you tick is sent anywhere. Tick them again when you change agents.` | 3 and 4 ("preflight", "checkout", "readiness") |
| Default page description | `Automata is an AI-first TypeScript game framework. Build with coding agents, verify their work, author the content and stay in control of the source.` | `Make 2D games for the web: draw the levels, let your coding agent write the code, and put the game online.` | 4 ("AI-first") and 3 |
| Guide "Draw levels in the editor", first screen | `automata editor opens the editors on your game's own files … the command is a small local server beside them` and `with the editor built once: pnpm --filter @mcthaydt/automata-editor build` | Run `pnpm exec automata editor`, open the address, draw, press Save, Ctrl+C; the server sentence moves under "Open it"; no build step (the editor ships inside the tools) | 2 (opened on internals) and untrue (build it first) |
| Guide "Publish to the web", first screen | `dist/ is the whole artifact, and any static host serves it` | `Run pnpm build:web && pnpm prepare:web, then upload everything in the dist folder to any web host. That's it.` | 2 and 4 ("artifact") |
| `automata editor`, first line | `Editing /home/ada/my-game with the 2d editor.` (`with the suite editor.`) | `Opened My game in the level editor.` (`in the editors.`, `in the 3D editor.`; the game named as Home names it) | 4 (a path and a flag value) |

### Kept, with the reason

| Where | Text | Why it passes |
|---|---|---|
| Home headline and lead | `Make browser games with your coding agent.`, `Automata is a framework for 2D web games. Your agent writes the code and the tests; you draw the levels and play the result in a browser tab.` | The Owner approved them in the mockup (2026-11-06 20:31), after the audit's row; "coding agent" is who the site is for. |
| Home's three reasons, code, editor and publish sections | as built in 18.2 | From the approved mockup; the engine words ("components and systems") sit under "The code", for the reader who wants them (WG1). |
| Start's four steps | `1. Make a game` … `4. Put it online`, each a command and what you see | One command each and what happens; the visitor journey now asserts all four headings. |
| Editor page | `Paint a room, then place its characters.`, `Try the editor`, `On your own game` | What you see, and one button. |
| How it works, API | engine words (`sim`, `tick`, `hash`, `Complete API reference`) | This is where the engine words live (WG1). |
| Demo failed | `This demo couldn't start. Try again or open it in a new tab.` | The audit kept it. |
| Playground boot timeout | `The preview did not start within 10 seconds.` | The button beside it depends on the state (Play or Retry), so the line does not name one. |
| 404, Privacy, Terms | as built | The audit passed them. |
| `automata check` output | `pass  typecheck (120 ms)`, `FAIL  levels`, findings as `file:line  rule  message`, `automata check: 2 findings` | For game authors and their agents; the JSON shape is a contract, and the steps' names are what `--help` explains (8.1). |
| Search hint | `Use arrow keys to move, Enter to open, Escape to close.` | The audit kept it. |

### Gone before this pass

The audit's rows for the Home subline and actions, the demo's poster and caption, the footer's tagline and links, the
old Editors page, the FAQ and the targets sentence: phase 18 replaced those strings (the footer is Docs, Examples,
Reference, Privacy, Terms and Contact; the targets are named by the publish section and the guides).

## Stage 6 grandma fixes (2026-11-07)

| Where | Was | Now | Why |
|---|---|---|---|
| Tile rules, row names and cell words | the rule's id (`ground-n-e`), `is 3`, `not 3` | `Ground, joined above and to the right`; `only solid`, `anything but spike` | 4 (ids and numbers) |
| Tile rule options | `flipX`, `flipY`, `breakOnMatch` | `Mirror left to right`, `Flip upside down`, `Stop after this rule` | 4 |
| Tile rule inspector | offered with no tiles in the game | only when the game has tiles | 2 (nothing to press) |
| Suite Home, editor names | `Levels 2D` | `Levels` | 4 |
| Characters, second section | `Settings for every level`, `None yet`, `Add a level setting` | `Settings every level has`, `No settings yet`, `Add a setting` | 3 |
| Characters, add button | `Add character` | `Add a character` | 3 |
| Characters, summaries | monospace | body type | 4 (code look for words) |
| Colour field | the trigger spelled the hex (`#e0a54a`) | a swatch and `Change`; the hex stays in the Custom field | 4 |
| Characters, "Only one per level" | a button that looked pressed | a switch | 2 |
| Map, Arrange levels | a bare choice | `Where your levels sit on the map. Drag a level to move it.` under it | 1 |
| Map, `Depth` | `Depth` | `Floor` | 4 |
| Level canvas, a tile with no picture | the tile's number drawn on every cell (`30`, `46`) | the cell's colour and a darker edge, no number | 4 |
| Start, step 1 | `A folder called my-game with a small working platformer in it: a level, a player and its tests.` | `A folder called my-game with a small working game in it: a square you move around a level, and its tests.` | 1 (it said what the template is not) |
| Home, "Built for agents" | `Agent skills teach your coding agent where gameplay lives, which rules it must keep and how to test a change.` | `Your game comes with tests, so your coding agent can check its own work after every change.` | untrue until AF's skills are public (audit C6) |


## Stage 6 fixes, the Level view and the audit's last findings (2026-11-07, second pass)

| Where | Was | Now | Why |
|---|---|---|---|
| Level view, corner of the canvas | `Fit the level in view` alone | `Zoom out`, the zoom as `100%`, `Zoom in`, then `Fit the level in view` | 1 (a mouse user could not read or reset the zoom; the approved mockup has it) |
| Level view, brush size | a box showing `1` that opened a popover (a phone's dock keeps this) | `Smaller brush`, the size, `Bigger brush` beside the tools | 2 (the approved mockup's − 1 +) |
| Top bar, in browser storage | lime `Save` and an unlabelled share icon | lime `Share` (icon and word), `Save` plain beside it | 2 (the level leaves by Share there; the mockup) |
| Level inspector, size | `512 × 288 px` | `32 wide × 18 high`, and `Sizes are in tiles of 16 px.` under it | 4 (pixels are a computer's unit) |
| Level inspector, Music | a text box | kept as a text box | the mockup draws a choice, but a new level has no audio files to choose from; a choice holding only `None` would be a control that cannot be used |
| Entities layer, new levels | `Characters` | `Characters and items` | 1 (a coin is not a character; spec 11.5) |
| Palette rows | name only | the number key at the row's right edge for the first nine (1 to 9 choose them) | 2 (the mockup) |
| Home, no levels | `Make your first one to start drawing.` and a second `New level` button | `Press New level to start drawing.` (the top bar's button is the one) | 2 (one button for one job) |
| Tiles, no tiles yet | an `Add tiles` button in the panel and another in the stage | the stage's only; the panel's appears once there is a first tileset | 2 |
| A 3D swatch file, a step past the ramp (task 5.3) | a bare colour number past the palette | `step is 0 to 7`, and for a game palette that is too small `ember step 7 (colour 255) is not in the palette Sixteen (0 to 15)` | 2 (the message gives the range) and 4 (a ramp has a name, not an index) |
| Ember Hall's name (task 11.2) | `Ember Hall` on the title, `AF Base 3D` on the page and the store, `Base 3d` in the editor and `Emberwick in 3D` in the design | `Ember Hall` in all of them | 4 (a folder name and working titles are not the game's name) |
| Ember Hall's menu, no Settings (task 11.2) | Settings only after pausing a game | a `Settings` button on the menu; Back from it returns to the menu | 2 (a player looks for Settings first on the menu) |
| Ember Hall's HUD (task 11.2) | `● 0`, the words only for a screen reader | `Embers 0 of 6` on the screen | 1 (a number with no name) |
| Levels 3D's tools (task 16.1) | `Sector`, `Vertex`, `Portal`, `Door`, `Window`, `Things` as plain words | `Room`, `Corner`, `Doorway`, `Door`, `Window`, `Thing`, each an icon over its name | 3 (a person draws a room, not a sector; "Thing" stays for what the game uses) |
| Levels 3D's views (task 16.1) | Plan, 3D, Walk only in a standalone bar | the same three words in the suite's top bar; on a phone one button named for the view it shows, opening a menu of the three | 3 (the button says where you are; the menu says where you can go) |

