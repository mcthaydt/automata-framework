# Customer value audit: making a game with an AI coding agent

Stage 1 (audit) of the customer value pipeline, 2026-11-08. Asked by the Owner, 2026-11-08 21:35: "Do an audit that
the editors and framework actually deliver on the value expected from the customer - we are customer obsessed, we are
crafting the perfect product from someone who is making games with AI".

The customer here is one person with a coding agent such as Claude Code. They want to describe a game, have the agent
write how it behaves, change what is in it themselves in the editors, play it, keep their work, and show it to someone.
This audit walks that whole journey on the real product, as that person, and ranks where the product falls short.

The standing decisions it keeps to: behaviour stays in code and content lives in the editors; the editors keep only
essential features; every editor is free on the web and people pay to download the app; launch waits for Pixi 3D to go
public.

## 1. The answer first

**The core promise works once you are inside it.** In this audit an agent wrote a coin feature test first. A person
placed two coins in the level editor and tuned the speed in the Tuner, and the game played both. One press of
Publish made a zip that played both too. Closing and reopening the editor kept the work. On a game folder the loop
from `create-game` to a playable zip took under fifteen minutes of real work. Its machine steps took seconds:
`create-game` under 1 s, `pnpm install` 3 s, `automata check` 9 s, Publish 10 s.

**A new customer would not get there today.** Five things stand in the way, in order of harm:

1. **Their agent is never told to install Automata's own skills** (V1). The site's copied prompt and the Start page
   send the agent for Superpowers and PixiJS skills and tell it to stop if they are missing. They never mention the
   `automata` plugin that holds the rules, the API and the check hooks. The public skills repository is one README.
   A new game has no `AGENTS.md` or `CLAUDE.md`.
2. **Typed words vanish after a reload while the bar says "Saved"** (V2). In Writer, Feel and the Tuner, text is written
   only when the field loses focus. This is part of what the Owner saw as "progress doesn't save".
3. **The agent does not know how content reaches behaviour** (V3). The agent's first coin feature passed its tests and
   did nothing in play. The skills never explain how code meets what a person makes in an editor: placed characters,
   tunables, events, words. The API reference leaves out ten packages the story and 3D games import, and the skill says
   an unlisted export "does not exist".
4. **The published `automata editor` refuses to start in a pnpm monorepo** (V4), or wherever pnpm has written a
   `pnpm-workspace.yaml`. It then tells the person to build a package that only exists inside this repository.
5. **The published editor cannot edit what the new game plays** (V5). The new game plays a feel and a sound, but the
   editor shows Feel and Audio as "Not in this build". The thread "Show every editor in the free web editor" owns that
   fix.

None of these needs a new feature. V1, V3 and V4 are small changes to `create-game`, the skills, the site copy and one
function in the editor command. V2 is one pattern in two shared field components.

## 2. What was audited, and how

| What | Where | Head |
|---|---|---|
| Framework, `create-game`, every editor, play, Publish | PR #522 (shared editors build), the top of the editors stack | `5cf0825b` |
| Site and try-it page | PR #521 (Credits) with PR #520's pricing copy merged in locally | `5fd3933c` + `b448da8e` |
| Agent plugin | `agents/automata` at `5cf0825b`, installed into Claude Code 2.1.319 from this repository's marketplace | plugin 0.0.5 |
| Public skills mirror | `mcthaydt/automata-skills` | `e14c0ba` (one README) |

The two stacks could not be merged for one run: `create-game`'s template conflicts in five files between #522 and
#521. That is finding V16.

**Two customers were simulated:**

- **The launch customer** (outside the workspace). `pnpm build`, then every published package packed exactly as npm
  would serve it (`tooling/consumer-smoke`'s `packPublished`). The tools were installed in a scratch folder outside the
  repository, with pnpm overrides standing in for the registry. Then `automata create-game my-game`, `pnpm install`,
  `pnpm check`, and `pnpm editor`.
- **The beta customer** (inside the workspace, which is how 3D and the story run before Pixi 3D is public).
  `create-game games/audit-story --link-workspace` (the 2D story template) and `--template 3d`, then `automata editor`
  on each.

**The agent** was this session, writing a feature the way the plugin's skills say to: test first, look up each API in
`automata-api`, `automata check` before finishing. This session knows the repository, so where that knowledge got it
past a gap, the finding says so. A fresh agent would have been stopped there.

**Browsers:** Chromium (Playwright) at an iPhone 13 (portrait and landscape) and a 1280 × 800 desktop, phone first.
WebKit, Firefox and a real iPad were not run (section 8). Screens are in the shared folder
`refactor/2026-11-08-customer-value-audit-screens/`.

## 3. The journey, step by step

| Step | What the customer expects | What happened | Verdict |
|---|---|---|---|
| Find the site | A clear promise; one thing to copy into the agent | Home v2 is clear: "Make browser games with your coding agent." "Copy the prompt for your agent" copies a prompt that installs two third-party skill sets and never Automata's own (V1). The promise is narrower than the product: "2D", "draw the levels" (V7) | Partly |
| Try it on the site | Paint something, see it played, keep it | The try-it paints a level and keeps it in browser storage across a new tab, although the page says "gone when you close it". It opens on a warning ("This is a sample game, not yours. Run automata editor…"); its first brush tap drops a Checkpoint; it cannot play (V9; saving is #528's) | Partly |
| Set up the agent | One step; the agent knows the framework's rules | Not possible outside this repository: the mirror is empty, the site never names the plugin, the new game has no instructions file (V1). From this repository the plugin validates and installs cleanly | Fails |
| `create-game` | A game that runs, with its tests | Works: 35 files, `pnpm check` green in 9 s. It prints `pnpm editor`, while the Start page says `pnpm dev` and then `pnpm exec automata editor` (V13). No git repository (V12). The 3D template refuses outside the repository, as decided | Works |
| Agent writes behaviour | The agent adds a feature in minutes and proves it | Test first, then the rule, in about ten minutes; the check passed. In play, the coins could not be picked up (V3, V6). After the agent sized the pickup to the drawn player, it worked | Works, with a trap |
| Edit content in every editor | Every editor the game uses, on the web, free | Launch customer: Levels, Characters and the Tuner; Feel, Audio and Schematic are "Not in this build" (V5). Beta customer: all eight in 2D and in 3D (Levels 3D, Characters, Tuner, Feel, Audio, Writer, Sequence, Schematic). Feel and Audio offer only the game's own events (V10) | Partly |
| Play | What I made, in the game | 2D: the coins, the score and the faster speed all played. The score at the top was hidden under the bar on desktop, and the phone in landscape crops the level (V8). Story: the keeper's dialogue box is crisp. 3D: Wick's room plays | Works |
| Reload, close, reopen | Nothing I did is lost | Clicks, sliders and the level canvas survived a reload and an editor restart. Typed words did not survive a reload, even 10 s later, with the bar showing "Saved" (V2) | Fails for text |
| Export and share | A link or a file a friend can play | Publish made a 330 KB zip in 10 s; served on its own, it played every edit. There is no link: the person uploads the zip to itch.io themselves (V11) | Works, no link |

## 4. Findings, ranked by harm to the customer

Each finding gives what the customer sees, the evidence, the cause, the fix, and who owns it. A finding a running
thread already owns is cross-referenced, not repeated in full.

### Critical: the promise breaks for most customers

#### V1. The customer's agent is never given Automata's own skills

- **What they see:** they copy Home's prompt into their agent. The prompt says "Confirm Superpowers is installed…
  Confirm the official PixiJS v8 skill collection is installed… If either collection is missing or cannot be loaded,
  stop". So the agent stops and asks them to install two third-party collections. It never installs the one that
  knows Automata. Once the game exists, opening the agent in its folder gives the agent nothing to read but the
  README: there is no `AGENTS.md` or `CLAUDE.md`, and no `.claude/` settings.
- **Evidence:** `site/src/shared/content/agent-prompt.ts:8` and `:17` (`SKILL_PREFLIGHT`, `AGENT_PROMPT`).
  `site/src/features/start/agent-setup.ts` and `AgentSetup.svelte:15`: "Give your agent two sets of skills:
  Superpowers… and PixiJS". `llms.txt` never names the plugin. `create-game`'s 35 files (listed in the scratch run) have
  no agent file. `mcthaydt/automata-skills` has one commit, a two-line README (`e14c0ba`). The plugin itself is fine:
  `claude plugin validate agents/automata` passes, and `claude plugin marketplace add <repo>` plus
  `claude plugin install automata@automata-framework` install it (Claude Code 2.1.319).
- **Why it matters most:** "Built for agents" rests on the plugin. It carries the seven laws, the exact API, test-first
  steps, and hooks that run `automata check` after each sim edit and before the agent stops. Without it, an agent
  writes game code with none of those.
- **Fix:**
  1. `create-game` writes `AGENTS.md`, plus a `CLAUDE.md` holding `@AGENTS.md`. Keep it to a page: the laws that bite,
     where things go, `pnpm check`, and the content contract from V3.
  2. `create-game` writes a `.claude/settings.json` that names the Automata marketplace and turns the plugin on, so
     Claude Code offers it when the folder is trusted. The plan must check the exact keys (`extraKnownMarketplaces`,
     `enabledPlugins`) against the Claude Code docs.
  3. The copied prompt and the Start page install the Automata plugin first, one command per agent. Superpowers and
     PixiJS become "also useful", and nothing tells the agent to stop.
  4. `llms.txt` names the plugin.
  5. The mirror's first push (the Owner's `SKILLS_TOKEN`) is a launch prerequisite (section 7).
- **Owner:** new. Fits the site, `create-game` and skills work after this audit.

#### V2. Typed words are lost on reload, with "Saved" on screen

- **What they see:** in Writer they change the keeper's line, wait, then reload the page or close the tab. The old line
  is back. The top bar said "Saved in your game folder" the whole time. The same happens to a Feel word's text and a
  Tuner control's name. On an iPad that puts a background tab to sleep, they lose it without reloading.
- **Evidence:** on a real game folder (the story game, #522 head), typing into Writer and waiting 10 s left
  `content/lines/keeper.toml` unchanged. After a reload the field showed the old words
  (`story-desktop-3-typed.png`). Pressing Tab before the reload saved it. The same check on Feel and the Tuner wrote
  nothing until the field lost focus.
- **Cause:** `extensions/editors/src/shared/ui/WordsField.svelte` and `FieldRow.svelte` commit on `onchange`, which
  fires on blur. `SuiteTopBar.svelte:89` shows "Saved in your game folder" whatever is still waiting in a field.
- **Fix:** write typed text as it is typed, debounced by a few hundred ms. Show "Saving…" until the write lands. Flush
  on `pagehide` and `visibilitychange`. Add a journey that types, reloads without leaving the field, and expects the
  words on disk and on screen.
- **Owner:** the sign-in and saving thread (PR #528), which owns "progress doesn't save". It found the in-memory
  every-editor page and the try-it copy, not this. This audit told that thread on 2026-11-08.

#### V3. The agent does not know how content reaches behaviour

- **What they see:** they ask for coins they can place in the editor. The agent writes a coin feature that passes its
  tests and `automata check`. In play, the player walks over the coins and nothing happens. Only an agent that already
  knew the template's insides got further.
- **Evidence:**
  - The skills mention one editor, the level editor (`automata` and `automata-editor` skills). They say nothing about
    Characters, the Tuner, Feel, Audio, Writer, Sequence or Schematic. They never say how a placed character becomes a
    sim entity (`entitiesOf`). They never mention `levelScene({ live })`: without it, core keeps drawing a coin the sim
    has removed. They never say how to add a number the Tuner shows (a `content/tuning.toml` row plus
    `src/shared/tuning.ts`), or that an event in a `.event.ts` file is what Feel and Audio can answer (that part works:
    `coin.collected` appeared in Feel's list by itself).
  - The API reference covers 13 packages. The story game imports 10 that are not there: `@automata/narrative`,
    `cutscenes`, `systems`, `nav`, `places`, `level-2d`, and in 3D also `sectors` and `3d`. Yet `automata-api` says
    "Not listed means it does not exist".
- **Fix:**
  1. A sixth skill, `automata-content`: "give the editors something to edit". It takes one row per editor: the file,
     the API that reads it, and what code must do so a person can change it. It covers placed characters with `live`,
     tunables, events, line keys, cutscene anchors and Schematic's characters. The coin is its worked example, with a
     test that places the coin in a level file, not at made-up coordinates.
  2. Generate the API reference for every package a template imports. Mark the private ones "beta" until they publish,
     and keep 3D text out of the public mirror until Pixi 3D is public (skills decision D2).
- **Owner:** new; skills work.

### High: a large share of customers hit it

#### V4. The published `automata editor` will not start in a pnpm monorepo, or after pnpm writes a settings file

- **What they see:** `pnpm editor` prints `Error: no editor build at <game>/extensions/editors/dist/suite. Build it
  first: pnpm --filter @automata/editors build`. Nothing they can do fixes it. Nothing in their game is wrong.
- **Evidence:** with the packed 0.0.5 tools, a game with an `allowBuilds` `pnpm-workspace.yaml` fails exactly so; the
  same game without the file opens. pnpm 10.34's `approve-builds` writes that file, and so does any pnpm 10 setting. A
  game kept inside a pnpm monorepo always has one above it.
- **Cause:** `packages/tools/src/features/editor/editor-command.ts:65` (`repositoryRoot`) and `:176` (`isRepository`).
  These treat any folder above the installed tools with a `pnpm-workspace.yaml` as this repository, so `outside` is
  false and the command looks for the repository's own build.
- **Fix:** use the packed page whenever it exists next to the bin. Recognise this repository by something only it has,
  for example its root `package.json` name. Add a consumer-smoke case with a `pnpm-workspace.yaml` in the game folder.
- **Owner:** new; small, could ride with the free web editor work.

#### V5. The published editors cannot edit what the new game plays

- **What they see:** the new game plays a camera shake, a "Bump!" word and a bump sound. Home marks Feel and Audio (and
  Schematic) "Not in this build. Its files open read only". "Build" is a word a drunk grandma would not follow. The
  story (Writer, Sequence) is left out of a game made outside the repository without a word, and 3D refuses.
- **Evidence:** `ed2d-desktop-1-home.png`. The command prints "Feel, Audio and Schematic are not in this release yet".
  `docs/guides/editor.md:23` says "a release of the tools has the 2D editors only".
- **Owner:** the thread "Show every editor in the free web editor" (the Owner, 21:33: every editor free on the web).
  Its fix must also cover what `create-game` writes outside the repository, the guide's sentence, and the story
  template's packages (V15).

#### V6. The starter's player looks 16 × 24 but is 8 × 8 at its feet

- **What they see:** their character visibly touches a coin and does not pick it up. They walk into a wall's picture
  and stop a few pixels early or late.
- **Evidence:** `square.view.ts` draws `pictureView(project, 'player-start', …)`, the Player start's 16 × 24 picture.
  `SQUARE_SIZE = 8` is the box the sim moves and collides (`walls.ts`). A coin placed at the player's chest height in
  the editor was out of reach (`game2d-desktop-3-after-move.png`).
- **Fix:** take the player's box from the `player-start` definition's size in the project, or draw what the sim
  collides with. Then what you see is what touches.
- **Owner:** new; template work.

#### V7. The site sells a 2D level editor; the product is eight editors and 3D

- **What they see:** the hero says "a TypeScript framework for 2D web games… You draw the levels". The announcement
  says "The level editor, in your browser", and the editor section says "Draw levels". `llms.txt` says "a deterministic
  2D game framework". The message this customer most wants to hear is never said: your agent writes how things behave,
  and you change everything else yourself, from levels, characters, feel, sound, words and cutscenes to how enemies
  think, then play it.
- **Fix:** copy only, on the approved v2 layout. Lead with that split, name the editors once, and say 2D and 3D on the
  day Pixi 3D is public. Make the same change in `llms.txt` and the README's first line.
- **Owner:** site copy, after the free web editor work lands (so the copy is true on the day).

#### V8. A score drawn at the top is hidden on desktop, and the phone in landscape crops the level

- **What they see:** the first thing most AI-made games add is "Score: 0" in the corner. Drawn at the top left with
  `draw(ctx).text(…, 4, 4)`, it is not visible on a desktop: the default screens' top bar covers about the top 14 of 288
  logical pixels (`game2d-desktop-4-hud-probe.png`, a 60 × 20 red box shows 6 pixels tall). Moved down, it is small
  and blurry. On a phone in landscape the level is scaled to the width, so about 50 of its 288 pixels are cut off, and
  the touch buttons sit over the lower part of the level (`game2d-phone-5-hud-low.png`). An upright phone is fine.
- **Owner:** blur and size belong to the in-game text thread (PR #524, MSDF on a crisp layer). That plan should also
  give the HUD a safe area the bar never covers. Cropping the level in landscape is new: fit the level and letterbox,
  or let the camera follow, but never cut off what the person placed.

### Medium: friction, confusion or lost trust

#### V9. Try-it: first minute

Saving and the try-it/editor split belong to #528. These are the other first-minute problems found there:
- The try-it opens on a warning: "This is a sample game, not yours. Run automata editor inside your game's folder to
  edit it." For a site visitor that is jargon and reads as an error. Say what it is instead: "A sample game to try.
  Make your own with one command."
- After choosing Platformer, the first brush tap drops a Checkpoint, because the palette's first character is
  selected. The Platformer template has a floor and no platforms, although it says "jump between platforms".
- On a phone the brush-size control is cut off at the right (`tryit-phone-3-level.png`), and the title shrinks to "Sa…".

#### V10. Feel and Audio cannot answer what the story's extensions say

In the story game, Feel and Audio can only answer the "square bumped" event
(`content/generated/events.json` = `["square.bumped"]`). The keeper talking, a cutscene starting and the guard spotting
the player happen in extensions, and the list reads only the game's own `.event.ts` files. Fix: the event list also
takes the ids that the game's plugins register. Owner: the shared editors fixes thread, or the next editors pass.

#### V11. Sharing stops at a zip

Publish works and is fast, but sharing means downloading a zip, making an itch.io project and uploading it. For this
customer, sending the game to a friend is the moment that pays off. `automata ship` already pushes to itch.io with
butler. Recommendation (decision D1 in section 6): add one step after "Download the zip", "Put it on itch.io", that
uses butler and the person's own itch.io key. That is still one essential action, and AF hosts nothing.

#### V12. `create-game` makes no git repository

The Owner's agent workflow is a branch, a pull request and a yes or no from the person, and the apps sync games with
GitHub. A new game has no `.git`, so the agent's first changes cannot be reviewed or undone. Fix: `git init` and a
first commit when git is installed, with `--no-git` to skip.

#### V13. Two "next steps" that disagree

`create-game` prints `pnpm install && pnpm editor`, and the game's README agrees. The Start page says `pnpm dev`, then
`pnpm exec automata editor`, "Draw its level". The editor already starts the game, so Start should be the same one
line, with Play and Publish named.

#### V14. The new game is coloured boxes, under a demo with art

Home shows Emberwick's pixel art. The new game is green and yellow rectangles, and its Characters view needs a picture
cut into frames that the game does not ship. Recommendation: a tiny starter sheet (player, coin, slime, a tile set) so
the first Characters edit swaps a picture for a picture. Art in the DUEL palette waits on the DUEL licence answer.

### Low: tidy-ups

- **V15.** Games made in the workspace from the story and 3D templates fail their own `automata check` (257 and 268
  findings: typecheck and tests resolve the private extensions' sources). With the plugin's Stop hook, every agent turn
  would end blocked on things it cannot fix. Known as M3 in the shared editors build audit (#523). It must be closed
  before those templates go public, and consumer smoke should run them with `AF_BETA_3D` and `AF_BETA_STORY`.
- **V16.** The editors stack (#522) and the site stack (#521) conflict in five `create-game` template files
  (`template-content/editors.toml`, `template-level.ts` and three tests). The site stack's fix for the try-it level (one
  level id) and the editors stack's tuning wiring must both survive the merge. The merge thread should play a try-it
  level in a new game after merging.
- **V17.** Every `pnpm test` in a new game prints `content/levels/start.af2d.json:1:1 skippedFile: this file is not
  read; items are named like dusk-run.toml` (the editor's own file, warned about with an example name from another
  project) and "no Svelte config found". The agent sees two warnings on every run and may try to "fix" them.
- **V18.** Ids where words belong in 3D: Characters lists "guard", "keeper" and "wick", with Skin "wick-shadow". Levels
  3D lists "spawn" beside "Barrel" and "Crate", and has a "Definitions…" button and a "58 px per metre" status line. Its
  tool row runs past the right edge at 1280 px (`ed3d-desktop-2-levels.png`). The default title for `audit-3d` is
  "Audit 3d". These belong to the editors v2 build.
- **V19.** The API reference's doc comments carry plan names ("Coordinates are logical playfield pixels (plan D-2)").
  AGENTS.md says comments do not name plans, and the customer's agent reads them.

## 5. What works and should be kept

- **Test-first gameplay is quick and honest.** A feature, its test and its wiring came together in minutes. The
  plugin's hooks run `automata check --sim-only` in about 3 s and the full check in about 9 s on a new game, short
  enough to run on every turn.
- **Events flow to the editors without wiring.** An agent's `coin.collected` event appeared in Feel's and Audio's lists
  on its own (`content/generated/events.json`). This is the right shape for the code and content split; V3 only needs
  it written down.
- **Saving to the game folder holds,** except for V2: coins, the speed and the level survived a reload and an editor
  restart, and git shows exactly what each editor changed.
- **Play and Publish carry edits.** The Tuner's split view restarts the running game on each change. The Publish zip
  played every edit on its own.
- **The story's dialogue box is crisp and readable;** the 3D room plays with its figures.

## 6. Recommended fixes, in order, and a decision for the Owner

| Order | Fix | Findings | Where it goes |
|---|---|---|---|
| 1 | Save typed text as it is typed; "Saving…" until written; flush on `pagehide`; a reload journey | V2 | Sign-in and saving thread (#528), told 2026-11-08 |
| 2 | Agent setup: `AGENTS.md`, `CLAUDE.md` and `.claude/settings.json` from `create-game`; prompt, Start and `llms.txt` install the Automata plugin first | V1 | New: plan with V3 as one "agent experience" slice |
| 3 | `automata-content` skill and a full API reference | V3 | Same slice |
| 4 | Editor command: the packed page wins; recognise the repository by name; consumer-smoke case | V4 | Same slice, or with the free web editor work |
| 5 | Every editor in the published tools and in a new game made outside the repository | V5, V15 | "Show every editor in the free web editor" |
| 6 | The starter's player box matches its picture; coins placed in level files in its tests | V6 | Same slice as 2 |
| 7 | HUD safe area under the bar; no cropping in landscape | V8 | In-game text (#524) for the safe area; new for cropping |
| 8 | Home, `llms.txt` and README say what the product is for this customer | V7, V13 | Site copy, after 5 lands |
| 9 | Try-it first minute; Feel and Audio hear extension events; `git init`; starter art; tidy-ups | V9, V10, V12, V14, V16 to V19 | Shared editors fixes, editors v2, the merge thread |

**D1 (the Owner's call): does Publish put the game on itch.io, or stop at the zip?**
- **A (recommended):** after the zip, one more button, "Put it on itch.io". It uses butler, which `automata ship`
  already drives, with the person's own itch.io key, and gives back the game's link. AF hosts nothing.
- **B:** keep the zip only at launch, and let the docs walk the upload.

## 7. Launch prerequisites (the Owner's steps; nothing above helps until they are done)

A customer today can reach none of it: `automataframework.com` did not answer through this session's network
(a 502 at the proxy). `@automata/tools` is a 404 on npm, and the scope belongs to another account until the
`@automataframework` rename. The skills mirror is one README. These are the open user-only steps in the project's
records: the npm organisation and token, the mirror's token and first push, the domain and site host, and Pixi 3D
going public.

## 8. Gates: what ran and what did not

| Ran | Result |
|---|---|
| `pnpm install`, `pnpm build` at `5cf0825b`; the site build at `5fd3933c` + `b448da8e` | Pass |
| Packed install outside the workspace; `create-game`, `pnpm check` on the new game, before and after the agent's feature | Pass (10 steps, 0 findings) |
| `claude plugin validate`, marketplace add and install of `agents/automata` (Claude Code 2.1.319, scratch config) | Pass |
| `automata editor` on the launch game, the story game and the 3D game; edits in Levels, Tuner, Writer, Feel; reload and restart | As in sections 3 and 4 |
| Play in Chromium: 2D (desktop, phone portrait and landscape), story, 3D (desktop, SwiftShader); Publish zip served and played | As in sections 3 and 4 |
| `automata check` on the story and 3D games made in the workspace | Fail (V15, known M3) |

Not run: WebKit, Firefox and a real iPad (not available in cloud sessions); Audio heard; Sequence and Schematic edits
played (covered by #522's journeys, 21 of 22 green in #523); a 3D game made outside the workspace (`@automata/3d` is
private and has never been packed); the try-it on the every-editor page (the free web editor thread). No code changed;
this pull request is the audit document and the progress page.
