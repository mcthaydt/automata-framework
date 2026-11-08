# Drunk grandma audit: the site and every non-3D editor (UX and copy)

**Date:** 2026-11-06. **Read-only:** no code was changed or pushed.
**What was tested:** the head of the stack, PR #418 (`claude/project-thread-bjrs94`, `ec06efc7`). I built the site
(`turbo build --filter=@mcthaydt/automata-site...`), served it with `vite preview` and walked it in Chromium, on a
desktop screen and on an iPhone 13 screen. I ran `automata editor` (from `packages/tools/dist/bin.js`) against
`games/emberwick` with the 2D level editor, with `--app suite`, and with the 2D-only suite build
(`--app-dir packages/editor/dist/suite`). After the save test I put Emberwick's content back with `git checkout`.
**Not covered here:** layout, spacing and screenshots at every size. The thread "Audit the site visually on all
devices" covers those. The 3D editors (Levels 3D, Studio) are out of scope too.
**Screens:** `refactor/2026-11-06-grandma-audit-screens/`.

**The test.** Picture a tired person who doesn't code, a little tipsy, on a phone or an iPad. Can they tell what this
is, get started, and understand every word on screen? A page fails when it uses a word she wouldn't know, sends her
somewhere that doesn't work, says something untrue, or leaves her with no next step.

**Answer today: no, on both counts.** The site is written for developers who already use coding agents. Its main
path asks her to clone a private repository and install agent plugins, and its commands use a package name that no
longer exists. The editors use engine words ("IntGrid", "Gates", "change set", "pivot", `MAX_RUN`). Two of their
main buttons lead to errors or to the wrong game.

---

## 1. How this audit relates to the plan

The slice plan already removes or rewrites a lot of what's below. Tasks 18.1 to 18.4 cut the site to seven pages,
18.2 rewrites Home and Start around `create-game`, 19.2 adds link checks, 20.1 adds the site copy table, and
12.1 to 12.5 redesign the 2D editor with the copy table in spec 11.5. Each finding below is tagged:

- **Planned:** a task already fixes it. The rewrite I suggest is input for that task's copy rows.
- **Partly planned:** a task touches it but misses the point raised here.
- **New:** no task covers it today. Add it to the plan (I suggest which task).

The most useful parts for the build threads are the **New** findings and the rewrite tables (sections 4 and 7).

---

## 2. Top findings, ranked

| # | Sev. | Where | Finding | Status |
|---|---|---|---|---|
| 1 | Critical | Site, Start, Quick Start | Every setup command is broken: `pnpm --filter @af-examples/base-2d ...` names a package that was renamed (`@af-games/emberwick`), and `git clone` targets a private repository that strangers can't read. Following the main path leads straight to an error. | Planned (18.2, 19.2) |
| 2 | Critical | Site, embedded Emberwick on a phone | On an upright iPhone, the home page demo says **"Turn your phone upright. Or add the game to your Home Screen to play it sideways."** The phone is already upright. The game reads the wide embed as landscape, and "add to Home Screen" makes no sense inside a website. So the one thing anyone can do on Home, play the game, fails on a phone. | **New** (19.1's journey should cover phone size; the fix is in the game's orientation check or the embed's aspect ratio) |
| 3 | Critical | Editor, Home on a checkout | **Platformer / Top-down RPG / Blank** (the "start a new project" cards) fail on Emberwick with the toast `untitled-platformer.af2d.json: untitled-platformer.af2d.json is not one the editor may write`. That's the main "make something" action. It hits a dead end, the message names the file twice, and it says nothing about what to do. | **New** (task 12.1: hide or explain the cards when the game's editor list rules them out, or save new levels where the list allows) |
| 4 | Critical | `automata editor --app suite` | The default suite command serves `editor-3d`'s suite. That suite didn't open Emberwick. It showed an in-memory **sample game** (one small grey "Sample game" label), said "Levels 2D: No files yet" next to a real room, and listed Levels 3D and Studio. The 2D-only suite in `packages/editor/dist/suite` opens Emberwick correctly, but only with `--app-dir`. So you see someone else's game and think it's yours. | **New** (fix the `BUILDS.suite` mapping in task 7.x or 8.x; when the editor falls back to a sample, show a full-width banner) |
| 5 | High | Site, Home and Start | **Promises that aren't kept.** "Play the original and the remix here", "Try it here before setting anything up" and "Toggle the extra jump off to compare" all point at a double-jump remix that no longer exists. The workshop was deleted, and `/start` has no demo. | Planned (18.2), but say so in its copy rows |
| 6 | High | Site, "Play Emberwick", "Source and controls", "Remix the room", "Open Emberwick's source" | All of these go to `/examples?demo=base-2d`, which ignores the query and shows the list of one-file examples. Emberwick isn't on it. | Planned (19.2 finds it); the link targets should move with 18.2 |
| 7 | High | Site, everywhere | **The first step is "set up an AI agent".** Start's main action is a 20-line prompt that starts with "check the skills available in this agent session… Superpowers… PixiJS v8 skill collection… SKILL.md". The setup also has a checkbox ritual ("3 of 3 confirmed by you"). Grandma has no agent and doesn't know what a skill is. | Planned (18.2 puts `create-game` first and moves agents to a section of Start) |
| 8 | High | Editor, Back with unsaved changes | Back leaves the level without a word, even while the status bar says "Unsaved changes". The edits come back later through a "Restore your unsaved work?" dialog, but only if she reopens the same level. Home meanwhile says "Saved" and "Autosave on". Two save stories at once: an autosave and a Save button, a "Saved" badge on Home and "Unsaved changes" in the editor. | **Partly planned** (11.5 changes the Save button; nothing covers Back or the double save model). Add to 12.2. |
| 9 | High | Suite top bar | "No change set", "No checks run", "Gates not readable", "Saving to the workspace" and "Ship" look like buttons. Opening one shows "no gate records here" or "No change set is open, so there is nothing to ship." These are engineering words with no way forward. | **New**, since the redesign is 2D-editor only (spec 11.6). Add a suite copy pass to 12.5 or 20.1. |
| 10 | High | Tuner | Every row is a constant name in capitals (`MAX_RUN`, `HALF_GRAVITY_BELOW`, `VAR_JUMP_TICKS`). Each note quotes another commercial game ("Celeste: 90 px/s") with numbers that don't match the value shown (384). Units are missing. "Lock" isn't explained. There's no way to feel the change. | **New** (Tuner isn't in the redesign. Add a task. The notes come from `games/emberwick/content/tuning.toml` comments, so the game owns them.) |
| 11 | Medium | Site, Docs | Docs opens on "Overview & Vision". Its package table lists six packages that no longer exist (`-runtime`, `-render-pixi`, `-ui`, `-host`); the API page shows four. Section names are jargon: "ECS Simulation & Determinism", "Effect Runtime & Concurrency", "Zero-Eval CSP & Host Security". | Planned (18.4) |
| 12 | Medium | Site, two API references | Footer: "API reference" → `/cheatsheet` and "Complete API" → `/api`. The `/api` page tells you to go to the other one. | Planned (18.1 redirects the cheatsheet) |
| 13 | Medium | Site, Editors page | It opens with a disclaimer that nothing here can be used, then lists nine editors with jargon ("af-sector format", "hint ladders", "tunables, within the bounds the content compiler reports"), all "(in development)". | Planned (18.3; 11.5 has the new line) |
| 14 | Medium | Site, search | Placeholder "Try createSim or snapshot". "how do I make a game" finds only the FAQ, and "level editor" puts "From Unreal" first. | **Partly planned** (pages change in 18.x; the placeholder and order aren't in any row). Add to 20.1. |
| 15 | Medium | Playground errors | "Line 63: Unexpected token. The preview is still running your last working version." is good. "The example's default export must be defineGame(...)." and the Determinism row ("these 120 ticks replay in this browser to the golden recorded in the framework (examples/__goldens__/…, framework ec06efc). Hash 9ea952469e517519.") are for developers only. | **New** (20.1) |
| 16 | Medium | Editor, Delete dialog | "Delete room-1.af2d.json? The file and its autosave are removed from this workspace. This can't be undone." On a game folder this deletes the game's level file, but she sees a file name, not "Emberwick room", and "workspace" doesn't say "your game". | **New** (12.1 copy rows) |
| 17 | Low | Site, examples list | Titles are lowercase fragments in engine words ("a chime on a sim event", "a HUD and a mini-map", "sprites drawn from a packed atlas"). The id is shown above the title in monospace. Groups are package words (core, render, shapes, textures). | **New** (20.1, or the examples' own header comments) |
| 18 | Low | Site, demo controls | Before you press Play, the demo shows "Restart", "Fullscreen" and "Open demo", and then the game has its own "Play" button too. That's two Plays, and Restart works on nothing. | **New** (minor; 18.2) |
| 19 | Low | CLI | `Editing … with the 2d editor.` / `with the suite editor.` | **New** (20.1: "Opened Emberwick in the level editor.") |

---

## 3. The site, journey by journey

### 3.1 "What is this?" (Home, first screen)
- Headline "Make a game. Make it yours." passes. Its subline doesn't: "A **TypeScript framework** for browser games. You
  bring the idea; your **coding agent** helps with code and tests." Two terms she won't know, in the one sentence
  that's meant to explain the thing.
  - Rewrite: "Make little games that run in a web browser, on a phone or a computer. Play one below, then make it yours."
- The two actions, "Make your first change" and "Play the starter", should come in the other order: playing comes
  first and needs nothing. "Starter" is a developer word. Use "Play Emberwick".
- Further down Home: "One state. Many views.", "Explicit ownership and separate packages", "Deterministic state,
  snapshots and replays lay the groundwork for multiplayer". This is architecture, not anything a player does. Spec WG1
  already puts these words in How it works and API. Make sure 18.2 actually removes them from Home.
- "Who this is not for: You need a visual scene editor or drag-and-drop game-making workflow." That's no longer true,
  because the level editor ships (D4). Planned (18.2), but list the row.

### 3.2 "Get started" (Start)
- Every step assumes a terminal, Node 24.21, pnpm 10.34.6, git, and a coding agent with two plugins. Each one can stop
  her cold. Spec 10.2's four steps (make, play, edit the level, publish) are the right shape. Each step should be one
  command and **what you'll see**:
  1. "Make your game: `npx @mcthaydt/automata-tools create-game my-game`. A folder called my-game appears."
  2. "Play it: `cd my-game` then `npm run dev`. Open the address it prints. You'll see your game."
  3. "Draw a level: `npx automata editor`. Your level opens in the browser. Paint, press Save, then reload the game."
  4. "Share it: … (web or itch.io)."
- Add one line above the steps: "You'll need Node.js (free). [How to install it →]". Without it, `npx` is the first
  dead end.
- "Make it jump twice." / "Your turn. Give it a twist." / "Play it. Check the change.": the double jump is now only a
  prompt. If 18.2 keeps it as a code sample, label it "Optional: let an AI assistant make the change".

### 3.3 Docs
- The first page anyone lands on should be "Make your first game", not "Overview & Vision".
- Section titles (rewrites for 18.4's nav):

| Today | After |
|---|---|
| Overview & Vision | What Automata is |
| Quick Start | Make your first game |
| ECS Simulation & Determinism | How it works (folded, per 18.4) |
| Zero-Eval CSP & Host Security | (folded into How it works) |
| Edit a game's levels with the editors | Draw levels in the editor |
| Publish to the web / itch.io / Ruken / desktop | Put your game online / on itch.io / on Ruken / on a computer |
| Install agent skills, AI Coding Agent Rules | Using an AI assistant (one page, at the end) |

- `docs/guides/editor.md` (a source guide 18.4 reads) opens with "serves an Automata editor against your game's own
  files … The editor runs in the browser; the command is a small local server beside it". It tells her to build the
  editor first (`pnpm --filter @mcthaydt/automata-editor build`), which isn't true once the editor ships inside `-tools`
  (phase 7). It also talks about `[[file]]` rows, "gates' records", "symbolic link". Rewrite its first screen:
  "Run `npx automata editor` in your game's folder. Open the address it prints. Draw, then press Save: your game
  uses the new level next time it starts." Move the rest under "Details". **New**: 18.4 reads guides but has no
  copy step for them. Add guides to 20.1's string list.
- `publish-to-web.md`: "`dist/` is the whole artifact", "`base: './'`", "assets inlined as `data:` URLs". Start with:
  "Run `npm run build:web`. Upload everything in the `dist` folder to any web host. That's it."
- "No matching sections. Try another topic." is fine.

### 3.4 Examples and the playground
- The examples index opens with a paragraph about preview frames, compile errors at "line and column", and "Restart
  runs the last code that compiled again, in a new frame". Replace it with one line: "Change the code on the left. The
  game on the right updates as you type."
- Error states (tested): a typo reads "Line 63: Unexpected token. The preview is still running your last working
  version." Good: it's plain, and clicking it jumps to the line. A thrown error reads "Line 1: boom. The preview is
  still running…". Fine. A file that isn't a game: "The example's default export must be defineGame(...)." Rewrite:
  "This code doesn't make a game. Press Reset to get the example back."
- The Determinism row belongs in a "For developers" disclosure, collapsed by default.
- Example titles: make them sentences that say what you'll see ("A bell that rings every second", "Move a square with
  the arrow keys", "A camera that follows the player"), and put ★ difficulty next to the title, not as a separate fact.

### 3.5 Navigation, search and the 404 page
- The header has both "Start" (twice on desktop: once in the nav, once as the button) and "AI". After 18.1, check that
  the header has at most four words: Start, Examples, Editor, Docs.
- Search: change the placeholder to "Search, e.g. jump, save, level". Rank guides above API names for queries in plain
  words.
- 404 ("Lost your place? That page is unavailable…") passes.
- Privacy and Terms pass. Keep them as they are (spec says unchanged).

---

## 4. Site copy rewrites (for task 20.1's rows)

| Where | Today | After |
|---|---|---|
| Home subline | A TypeScript framework for browser games. You bring the idea; your coding agent helps with code and tests. | Make little games that run in a web browser. Play one below, then make it yours. |
| Home actions | Make your first change · Play the starter | Play Emberwick · Make your own game |
| Demo poster | Play here. No setup needed. | Play here. Nothing to install. |
| Demo caption | Move with arrows or A/D. Jump with Space. | (phone) Tap the arrows to move and ↑ to jump. (desktop) Arrow keys to move, Space to jump. |
| Demo toolbar | Restart · Fullscreen · Open demo · Stop demo | Shown only while playing: Start over · Full screen · Open in a new tab · Stop |
| Demo failed | This demo couldn't start. Try again or open it in a new tab. | (keep; it passes) |
| Fullscreen | Fullscreen did not start. Open the demo in a new tab. | Full screen isn't available here. Try "Open in a new tab". |
| Footer tagline | AI-first game development. Code with agents. Keep creative control. | Make games in your browser. Your ideas, your levels, your code. |
| Footer links | First AI change · API reference · Complete API · AI & Skills · Capabilities & MIT license | Get started · Reference · Using an AI assistant · Free to use (MIT) |
| Editors page | None of these is released yet and there is no editor to open on this site… | Draw your levels by hand. Try the editor → (11.5's row) |
| Search placeholder | Try createSim or snapshot | Search, e.g. jump, save, level |
| Search title | Find your way | Search |
| Search hint | Use arrow keys to move, Enter to open, Escape to close. | (keep) |
| Examples intro | (the paragraph about frames and compiles) | Change the code on the left. The game updates as you type. |
| Playground, not a game | The example's default export must be defineGame(...). | This code doesn't make a game any more. Press Reset to start again. |
| Playground, live off | Live updates are unavailable in this browser. Play still runs the original. | This browser can't update the game as you type. Press Play to see the original. |
| FAQ "Do I need to know how to code?" | You should be willing to read and change TypeScript… it does not turn game development into a no-code workflow. | A little. You can play, change levels in the editor and tune values without code. New rules and characters are written in TypeScript, by you or with an AI assistant. |
| Targets sentence | A game builds for any static web host, for itch.io or for Ruken (automata-ship publishes to the last two), and a desktop build (Tauri) for Windows, macOS and Linux is planned. | Put your game on any website, on itch.io or on Ruken. A version for Windows, Mac and Linux is coming. (Check the desktop status with W4/W7 first: spec 18.4 says not to call it "planned".) |

---

## 5. The 2D level editor (tested against Emberwick on an iPad-sized screen)

What works: "Open" opens the room, painting on the Collision layer works, Save writes `content/rooms/room-1.af2d.json`
and `content/levels/room-1.toml`, and the "Restore your unsaved work?" dialog is mostly plain. The level view is
clear: you can see the room, and the Ember and the Player start are labelled on the canvas.

### 5.1 Findings
1. **Critical: new project fails on a game folder** (finding 3 above). Screenshot: `ed-new.png`.
2. **High: Back drops you out with unsaved edits** (finding 8). Rewrite: on Back with changes, ask "Save your
   changes to Emberwick room? · Save · Don't save · Cancel". Pick one save story. Spec 6.2 makes Save write the game,
   so the autosave is a safety net and should stay out of sight: drop "Autosave on" and "Edits are autosaved beside
   your projects…" from Home. When something is restored, say "We kept your unsaved changes from last time".
3. **High: engine words in plain sight.** Spec 11.5 renames most of them (Map, Tiles, Characters, "Walls and floors",
   "Copy a tile"…). Still missing from its table:
   - "No auto layer reads an IntGrid yet." (Tiles)
   - "Rule · Group · Choose a rule, or add one to this group." (Tiles: what's a rule?)
   - "Free · Grid · Row · Column" (World, the layout of the map)
   - "0 fields · ellipse · single", "pivot 0.5, 0.5", "Placed with its pivot on the snapped cell · 8× zoom",
     "rect / ellipse / point / tile", "Single per level", "Id", "Level fields every level" (Entities)
   - "Level project" badge, "OPEN FROM · This workspace · 1 project · game checkout" (Home)
   - "3.2 KB · 7 min ago" and the file path under every title (Home, document frame)
   - "What to export · Project file · Game files", "Share and Copy take one file; Download takes them all." (Export)
   - "Save already writes your game's files into content." (Export): good that it's said, but it's in the wrong
     place. This is the first moment she learns where Save goes.
4. **Medium: two names for one thing.** The card says "Emberwick room", the level is "Room 1", the file is
   `room-1.af2d.json`, the Delete dialog says "Delete room-1.af2d.json?", and the entity is called "goal" in
   Entities but "Ember" on the canvas and in the palette. Rule for 12.x: show the label people gave it, everywhere.
   Show the id or file only under "Details".
5. **Medium: the Delete dialog** (finding 16). Rewrite: "Delete Emberwick room? This removes the level from your game
   for good. · Cancel · Delete level".
6. **Medium: the left rail on an iPad** shows Level, World, Tilesets, Entities, Checks, Export as tiny grey words with
   no icons, and Checks "No problems" gets a whole view. 11.5 already folds Checks into a "2 problems" badge. Make
   sure the rail icons from 11.2 have labels.
7. **Low: Brush size `− 1 +` is clipped** at the top-right of the tool bar on iPad width. (Layout. The visual thread
   may report it too.)

### 5.2 Level editor copy rewrites (add to 12.5's table)

| Where | Today | After |
|---|---|---|
| New project fails | untitled-platformer.af2d.json: untitled-platformer.af2d.json is not one the editor may write | This game only keeps levels in content/rooms. [Make it there] (or hide the cards) |
| Home storage | Autosave on · Saved in your game folder · Edits are autosaved beside your projects… | Saved in your game folder |
| Home source | OPEN FROM · This workspace · 1 project · game checkout | Your game: Emberwick |
| Home card meta | Level project · 3.2 KB · 7 min ago · content/rooms/room-1.af2d.json | Changed 7 minutes ago |
| Restore dialog | Restore your unsaved work? This file has edits that were never saved. The autosave kept them as they were made. File on disk: Unchanged since the autosave began · Discard · Restore edits | You have unsaved changes from last time. Keep them? · Throw away · Keep my changes |
| Back with changes | (nothing) | Save your changes to Emberwick room? · Save · Don't save · Cancel |
| Delete dialog | Delete room-1.af2d.json? The file and its autosave are removed from this workspace. This can't be undone. | Delete Emberwick room? It's removed from your game for good. · Cancel · Delete level |
| Tiles empty | No auto layer reads an IntGrid yet. · This project has no tileset yet. | No tiles yet. Add a picture of your tiles to paint with them. [Add tiles] |
| Tiles rules | Rule · Group · Choose a rule, or add one to this group. | (hide until there are tiles) |
| Map layout | Free · Grid · Row · Column | Arrange levels: Anywhere · In a grid · In a row · In a column |
| Map empty | Choose a level on the map or in the list. | Tap a level to edit it. |
| Characters list | goal · 0 fields · ellipse · single | Ember (one per level) |
| Characters shape | rect · ellipse · point · tile | Box · Circle · Dot · Picture |
| Characters pivot | Pivot x/y 0.5 · Placed with its pivot on the snapped cell · 8× zoom | (move under "More": "Anchor point") |
| Characters flag | Single per level | Only one per level |
| Characters id | Id: goal | (under "More": "Name in code") |
| Level fields | Level fields every level · none yet | Settings for every level · none yet |
| Export | What to export · Project file · Game files · Share and Copy take one file; Download takes them all. | Share: Download a copy · Copy to clipboard. (11.5 renames the view to Share) |
| Status bar | Unsaved changes / Saved | (11.5: the Save button says it) |

---

## 6. The suite and the Tuner (every non-3D editor)

Which non-3D editors exist in code today: **Levels 2D** (above), **the Tuner**, and **the suite shell** around them
(Home, Review, Ship, Export, Import and the top bar pills). The site's Editors page also lists **Audio** (framework),
**Feel, Writer, Schematic and Sequence** (Plus). None of those has code in this repository (I searched
`packages/`), so there's nothing to test. Their one-line descriptions are on the site, though, and they fail the
test: "Camera, pose, visual, word, haptic and audio effects by channel", "Dialogue, beats and hint ladders",
"Puzzle definitions and the agents and rules of a systems game", "Cutscene shots, lenses, actors and cues", "Sound
recipes, rendered to audio files at build time". When each one is designed (Plus is the Owner's call, D12), its spec
should start from a one-line "what you can make", for example "Writer: write what your characters say."

### 6.1 The suite shell
1. **Critical: `--app suite` opens the wrong suite on a sample game** (finding 4). Screens: `suite-home.png` (3D
   suite, sample) and `suite2-home.png` (2D suite, Emberwick). Whenever the editor falls back to a sample, say so in a
   full-width banner: "This is a sample game, not yours. Run `automata editor` inside your game's folder to edit your
   game."
2. **High: the top bar is engine talk** (finding 9). Rewrites:

| Today | After |
|---|---|
| Editors (title) + "Sample game" chip | Emberwick (the game's own name) |
| Saving to the workspace | Saved in your game folder |
| No change set | (hide until there are changes; then "3 changes · Review") |
| No checks run | (hide; run checks on Review and show "All good" or "2 problems") |
| Gates not readable · no gate records here | (hide when the game has no gates; this is a CI concept) |
| Ship · "Ship this change · No change set is open, so there is nothing to ship." | Share or Publish (disabled with "Nothing new to publish yet" as its tooltip) |
| ↶ ↷ (icon only, no label) | Undo · Redo (labels, as the 2D editor has) |
| This game's editors · Levels 2D · content/levels/room-1.toml · content/project.toml · content/rooms/room-1.af2d.json · content/world.toml | What do you want to change? · Levels: Emberwick room · Movement: how Wick runs and jumps |
| "3 more in this group" (under the level) | (hide the generated files; they're not hers to open) |

3. **Medium:** Home lists four file paths under Levels 2D. Three of them (`levels/room-1.toml`, `project.toml`,
   `world.toml`) are files Save writes, and opening one would edit generated output. Spec 6.2 says Save writes those,
   so the Home tile should list levels by name only.

### 6.2 The Tuner (`suite2-Tuner.png`)
1. **High: the names are code constants.** `MAX_RUN`, `RUN_ACCEL`, `AIR_ACCEL`, `GRAVITY`, `HALF_GRAVITY_BELOW`,
   `MAX_FALL`, `JUMP_SPEED`, `VAR_JUMP_TICKS`, `COYOTE_TICKS`, `BUFFER_TICKS`. Give each tunable a label and a one-line
   "what you'll feel". The game's `tuning.toml` (or the Tuner's schema) should carry it:

| Today | Label | Note |
|---|---|---|
| MAX_RUN | Top running speed | How fast Wick runs. |
| RUN_ACCEL | Speed-up on the ground | Higher feels snappy, lower feels slippery. |
| AIR_ACCEL | Steering in the air | How much you can change direction mid-jump. |
| GRAVITY | Gravity | Higher falls faster and jumps lower. |
| HALF_GRAVITY_BELOW | Floaty jump top | Wick hangs a moment at the top of a jump while you hold jump. |
| MAX_FALL | Top falling speed | How fast Wick can fall. |
| JUMP_SPEED | Jump power | How high Wick jumps. |
| VAR_JUMP_TICKS | Hold for a higher jump | How long holding jump keeps Wick going up. |
| COYOTE_TICKS | Late jump grace | You can still jump just after running off a ledge. |
| BUFFER_TICKS | Early jump grace | A jump pressed just before landing still counts. |

2. **High: the notes quote another game.** "Celeste: 90 px/s." sits next to a value of 384, so the note looks like
   a mistake. (The units differ: the TOML header explains the scale, but the Tuner doesn't show the header.) Show the
   unit she can feel ("tiles per second", "frames", or none), and keep where the numbers came from in the TOML
   comment, not on screen. Also check this against the standalone rule (Owner, 2026-10-31: published text never names
   source projects). Celeste is an outside reference, not a source project, but it's a commercial game's name on the
   screen.
3. **Medium: "Lock"** on every row is unexplained. If it means "keep this value when I press Reset all" or "don't let
   an agent change it", say so: "Keep" with the tooltip "Lock this value so it isn't changed".
4. **Medium: no way to try it.** Tuning jump feel without playing is guesswork. A "Play to try it" button that
   opens the game with the new values is the one thing that would make the Tuner usable by anyone. (UX idea, not a
   copy fix. Planned nowhere.)
5. **Low:** the right panel says "Choose a tunable to see its bounds and note". Use "Tap a setting to see more."

---

## 7. A rule set for every future string (proposed for `docs/refactor/copy.md`)

Spec 11.5 gives four questions. These rules, drawn from this audit, help apply them:

1. **Name things the way she would.** Level, character, wall, tile, setting, your game. Never: project, workspace,
   checkout, entity, definition, IntGrid, tunable, change set, gate, artifact, manifest, sim, tick, pivot.
2. **One name per thing, everywhere.** Use the label she gave it. Ids, file names and paths go under "Details".
3. **Every message says what to do next.** "X happened. Do Y." An error with no action fails the test.
4. **Hide what she can't use yet.** No "Gates", no "No checks run", no three-file lists, no "(in development)" lists.
5. **Show, then tell.** The playable demo, the level and the game come first. Explanations come second and stay short.
6. **Never say what isn't true.** No remix that isn't there, no "no visual editor" when there is one, no packages that
   were removed. Facts on the site should come from the build, as spec 10.4 asks.
7. **Talk to the person in front of the screen.** The editor and Start speak to a game maker. Agent prompts, the
   architecture and the API live behind one "For developers" door (WG1).

---

## 8. Suggested plan additions (all small)

| Add to | What |
|---|---|
| 12.1 | New-project cards on a checkout: make the level where the editor list allows, or explain why not (finding 3). Delete dialog by label. |
| 12.2 | Back with unsaved changes asks. One save story (drop the visible autosave copy). |
| 12.5 | The rows in section 5.2 that 11.5's table lacks. |
| 7.x / 8.x | `automata editor --app suite` serves `packages/editor/dist/suite` (the 2D suite) in the 2D release. Full-width banner when a sample is shown. |
| New, after 12.5 | Suite shell and Tuner copy pass (section 6): pills, Home tile, labels and notes for tunables, "Play to try it". |
| 18.2 / 19.1 | Phone-size Emberwick embed must start in portrait (finding 2); the visitor journey runs at phone size too. |
| 18.4 / 20.1 | The guides (`docs/guides/*.md`) are in 20.1's string list; editor.md drops the "build it first" step. |
| 20.1 | Search placeholder, playground messages, examples titles, CLI "Editing … with the 2d editor." |
