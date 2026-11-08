# Customer value for AI game makers: spec

Stage 2 (spec and plan) of the customer value pipeline. It answers the audit
([`2026-11-08-customer-value-audit.md`](2026-11-08-customer-value-audit.md), PR #530). The plan is
[`2026-11-08-customer-value-plan.md`](2026-11-08-customer-value-plan.md).

The customer is one person with a coding agent. They describe a game, the agent writes how it behaves, they change
what is in it in the editors, they play it, keep it and show it to someone. Behaviour stays in code; content lives in
the editors (the Owner, 2026-11-08 04:14).

Every path cited was read at PR #522's head (`5cf0825b`, the editors stack) or PR #521's head (`5fd3933c`, the site
stack). Package names are today's `@automata/*`; the `@automataframework` rename, when it lands, renames them here too.

## 1. What is in, what is out

| Finding | Here? | Where it goes |
|---|---|---|
| V1 agent never given the Automata plugin | Yes | Sections 2 and 3 |
| V2 typed words lost on reload | **No** | The sign-in and saving thread (PR #528, its P14) |
| V3 agent does not know how content reaches behaviour | Yes | Section 4 |
| V4 published `automata editor` refuses under a `pnpm-workspace.yaml` | Yes | Section 5 |
| V5 Feel and Audio "Not in this build" | No, hand-off | "Show every editor in the free web editor"; acceptance in section 12 |
| V6 player drawn 16 × 24, collides 8 × 8 | Yes | Section 6 |
| V7 site sells a 2D level editor | Yes, after V5 lands | Section 10 |
| V8 HUD under the bar | No, hand-off | In-game text (PR #524/#526) owns the HUD safe area; acceptance in section 12 |
| V8 landscape phone crops the level | Yes | Section 9 |
| V9 try-it first minute | Yes (copy and first tap) | Section 8; saving and the try-it split stay #528's |
| V10 Feel and Audio cannot hear extension events | Already met | Section 7 (the editors list them; a test guards it) |
| V11 sharing stops at a zip | Yes, D1 = A | Section 11 |
| V12 no git repository | Yes | Section 8 |
| V13 two "next steps" that disagree | Yes | Section 10 |
| V14 starter is coloured boxes | Yes, gated | Section 10 (waits on the DUEL licence answer) |
| V15 story/3D games fail their own check | No, hand-off | Shared editors fixes (M3, #523); acceptance in section 12 |
| V16 #521/#522 conflict in five create-game files | No, hand-off | The merge thread; acceptance in section 12 |
| V17 noisy warnings on every test run | Yes | Section 8 |
| V18 ids where words belong in 3D | No, hand-off | Editors v2 build; acceptance in section 12 |
| V19 plan names in API doc comments | Yes | Section 12 |

## 2. One way to get Automata's skills (V1)

The public mirror (`mcthaydt/automata-skills`, a copy of `agents/automata` made after each release) becomes a plugin
marketplace of its own. `agents/automata/.claude-plugin/marketplace.json` names marketplace `automata`, with one
plugin, `automata`, whose source is `./`. This was checked with Claude Code 2.1.319 on 2026-11-08: a plugin folder
holding both files passes `claude plugin validate`, `claude plugin marketplace add <folder> --scope project` and
`claude plugin install automata@automata --scope project`. The repository root's own marketplace
(`automata-framework`, for collaborators) stays as it is.

So for every customer:

- **Claude Code:** `/plugin marketplace add mcthaydt/automata-skills`, then `/plugin install automata@automata`.
- **Any agent that reads skill folders** (Codex, Cursor and others): `npx skills add https://github.com/mcthaydt/automata-skills`,
  the same tool the site already uses for the PixiJS skills.
- **A game folder made by `create-game`** names the marketplace and turns the plugin on (section 3), so Claude Code
  offers it the first time the folder is trusted, with no command at all.

## 3. What `create-game` writes for the agent (V1)

Three new files in every template (2D, story, 3D):

- **`AGENTS.md`**, one page, made for the template it is in: what the game is; the laws that bite in a game (only the sim
  changes gameplay; no `Math.random`, `Date` or I/O in a sim file; content is a file an editor writes, never a number in
  code); where things go (the template's own folder table); the content contract in five lines with a pointer to the
  `automata-content` skill; how to verify (`pnpm check`); and how to get the skills if they are missing (section 2's
  lines). It never says "stop": an agent without the skills can still read this page and work.
- **`CLAUDE.md`**, one line: `@AGENTS.md`. Claude Code reads it; other agents read `AGENTS.md`.
- **`.claude/settings.json`**, exactly:

  ```json
  {
    "extraKnownMarketplaces": {
      "automata": { "source": { "source": "github", "repo": "mcthaydt/automata-skills" } }
    },
    "enabledPlugins": { "automata@automata": true }
  }
  ```

  The keys are the ones `claude plugin marketplace add --scope project` and `claude plugin install --scope project`
  write (checked as above). The repository name is one constant (`AUTOMATA_SKILLS_REPO`), so the rename changes one line.

The game's `.gitignore` gains `.claude/settings.local.json` (a person's own settings), never `.claude/` as a whole.

## 4. The content contract, written down (V3)

**A sixth skill, `automata-content`: "Give the editors something to edit."** Its description triggers on adding
anything a person should be able to change: a placed thing, a number, a sound or shake, words, a scene, a character
that thinks. Its body is one table, a row per editor:

| Editor | The file a person changes | What reads it | What the code must do |
|---|---|---|---|
| Levels 2D | `content/levels/*.af2d.json` (and the `exports` it writes) | `entitiesOf(level, layer)`, `levelScene({ live })` | Spawn one sim entity per placed item, and list its definition in `live` so core stops drawing it |
| Characters | the definition's picture and size in the level project | `pictureView(project, def, images)` | Draw the entity with `pictureView`; take its box from the definition's size (section 6) |
| Tuner | `content/tuning.toml` | the sim's `ctx.content.tuning` through `src/shared/tuning.ts` | Add a row with a range, and a field to `Tuning`; never a constant in code |
| Feel, Audio | `content/feel/*.toml`, `content/audio/*.toml` | the game's events | Emit a `defineEvent` from a `.event.ts` file; the editors find it by itself |
| Writer | `content/lines/*.toml`, `content/dialogue/*.toml` | `wordsOf` from `@automata/narrative` | Show words by line key, never a string in code |
| Sequence | `content/cutscenes/*.toml` | `cutscenesExtension({ anchor })`, `levelAnchors` | Name characters by their placed id (`actor:keeper`) |
| Schematic | `content/systems/*.toml`, `content/nav/*.toml`, `content/puzzles/*.toml` | `systemsExtension`, `createNavExtension` | Give the thinking character a `SystemsAgent` |

The skill is copied to the public mirror, so it has no 3D row until Pixi 3D is public (skills decision D2). A 3D game
is made only inside the repository today, and its own `AGENTS.md` carries the two 3D rows (Levels 3D:
`content/levels/*.af-sector.json`; Characters 3D: `content/figure*/*.toml`).

The worked example is the audit's coin: a `coin` definition in the level project, coins placed in
`content/levels/start.af2d.json`, a sim feature that spawns one entity per placed coin, `live: [..., 'coin']`, a
`coin.collected` event Feel and Audio answer, and a test that loads the level file (not made-up coordinates) and walks
the player into a coin. The exact rows are taken from the templates when the skill is written, and a test keeps them
true (plan Task 3).

The `automata` skill's "Where a change goes" points at it, and the stale `automata-editor` skill (it describes only the
2D level editor) is rewritten for every editor the game's `content/editors.toml` lists.

**The API reference covers what the templates import.** `automata-api`'s reference adds every package a create-game
template imports, published or not. A private one is listed under a "Beta" heading: "Works in a game made inside the
AutomataFramework repository; not published yet." 3D packages (`@automata/3d`, `@automata/sectors`) are left out until
Pixi 3D is public (skills decision D2), and the reference says so in one line. "Not listed means it does not exist"
stays, now true for every import a template makes.

## 5. The published editor starts anywhere (V4)

- **The packed page wins.** When the tools carry a packed editor page next to the bin, that page is used, wherever the
  game is. Done on #532 (`builtApp()` returns the packed page first); what is left is the message `outside` picks.
- **The repository is recognised by its name**, not by any `pnpm-workspace.yaml`: the nearest folder above the tools
  whose `package.json` is named `automata-framework`. A customer's monorepo, or a game whose pnpm wrote a settings file,
  is never mistaken for it.
- The consumer smoke opens the editor on a game folder that holds a `pnpm-workspace.yaml` (the stranger test already
  writes one for its overrides).

## 6. What you see is what touches (V6)

The player's collision box is the `player-start` definition's size in the level project (16 × 24 in the starter), not
a constant. Its position is its pivot, the middle of its feet, as every other placed character's is, so the picture is
drawn with no offset. The app reads the size from the project once (`playerBoxOf(project)`) and gives it to the sim in
its content, so a change in Characters moves the content hash, as any gameplay change must. The 2D and story templates
both change; `SQUARE_SIZE` goes away.

## 7. Feel and Audio hear the extensions (V10)

Already met (plan audit A3). `extensions/editors/src/shared/game-events.ts` gives Feel and Audio the events of every
extension whose content the game has (systems, dialogue, cutscenes, puzzles), from the extensions' own `defineEvent`s,
beside the game's own list. In the story game Feel offers "a conversation shows a line", "a cutscene starts" and "a
character catches the player". The audit read only `content/generated/events.json`. A test keeps it so (plan Task 11);
no extension's `package.json` gets a second list.

## 8. The first minute (V9, V12, V17)

- **Try-it (V9).** The note becomes "A sample game to try. Make your own with one command." The first brush after
  choosing a template is the template's ground (its first IntGrid value or tile), never a character. The Platformer
  template gets platforms. On a phone the brush-size control and the title fit (no "Sa…"). Saving and the try-it split
  stay #528's.
- **Git (V12).** `create-game` runs `git init` and makes a first commit, "Start <title>", when git is installed, and
  takes `--no-git` to skip. If git is missing it says so in one line and goes on. If the commit fails (no git name set),
  the folder is still a repository and it says how to commit.
- **Quiet runs (V17).** The content compiler skips the editors' own project files (`*.af2d.json`, `*.af-sector.json`)
  without a warning, and every template writes a `svelte.config.js`, so `pnpm test` prints neither warning.

## 9. The whole level on a phone held sideways (V8, cropping)

In a landscape view the playfield is fitted, not cropped (this is every AF game's landscape view, Emberwick
included; a desktop window wider than the field gets side bars): its scale is the smaller of the width and height ratios, and
it is centred, with bars at the sides when the view is wider. Nothing a person placed is cut off. The bars' crop
fraction (`DEFAULT_BAR_FRACTION`) stays for games that ask for it; the default becomes `0`. The touch controls then sit
in the side bars on a wide phone, not over the level. Portrait layout does not change. This moves landscape visual
baselines; each is looked at and explained before it is accepted.

## 10. What the site says (V1 site part, V7, V13, V14)

- **The copied prompt and Start's agent setup (V1).** Step one is the Automata plugin, one command per agent
  (section 2). Superpowers and PixiJS become "Also useful", with their own commands. Nothing tells the agent to stop.
  `llms.txt` names the plugin and the two install lines.
- **What the product is (V7).** Lead with the split: "Your agent writes how your game works. You change everything in
  it yourself, in the editors: levels, characters, feel, sound, words, scenes and how enemies think. Then play it."
  Name the editors once. No "2D" in the promise; "2D and 3D" only on the day Pixi 3D is public. The same change in
  `llms.txt`, the page description and the README's first line. This lands after the free web editor work, so it is
  true on the day.
- **One set of next steps (V13).** Start's steps become: 1. Make a game (`create-game`), 2. Open it
  (`cd my-game && pnpm install && pnpm editor`, which starts the game and every editor), 3. Play and Publish, from the
  editor's top bar. The same words as `create-game`'s "Next:" line and the game's README.
- **Starter art (V14).** A small starter sheet (player, coin, slime, tiles) in the DUEL palette replaces the boxes, so
  the first Characters edit swaps a picture for a picture. It waits on the DUEL licence answer; the art's source is
  decided then.

## 11. Sharing: decision D1 = A (V11)

**D1 is answered: A** (the Owner, 2026-11-08 22:31, on the audit's decision card: "Put it on itch.io"). Both parts
below are built:

- **The guide:** the existing `docs/guides/publish-to-itch.md` gains a first part, "From the editor", that walks the
  upload by hand in four short steps (the fallback when butler is not wanted), and the Publish dialog's note links to it.
- **Publish in two steps.** The Owner, 22:32: "the zip should be separate from itch, do the zip then ask where they want,
  itch will be first output". So:
  1. **Make the zip.** Publish always makes the zip first, as its own step, with "Download the zip". The person can
     keep it whatever they do next.
  2. **"Where do you want to put it?"** A list of places, one button each. itch.io is the first and, for now, the only
     one. A place is a small record in a list (its name, what it needs, and how it uploads), so adding the next place
     (Ruken, a web host) is one new entry and no change to the dialog.
- **itch.io, the first place.** It uses butler, which `automata ship` already drives, signed in with the person's own
  itch.io account (`butler login`, itch.io's own sign-in) or their `BUTLER_API_KEY` if they set one. AF never writes
  either. It asks once for the itch.io page's address and writes it to `ship.config.ts`'s `itch.project`. It gives back
  the game's link with "Copy link". What butler cannot do is said, not hidden: the itch.io project must exist first,
  and the first time its kind must be set to HTML so it plays in the browser. Each is one sentence with a link, in the
  dialog.

## 12. Hand-offs and tidy-ups

Each hand-off is checked by this pipeline's build audit, not built here:

| Finding | Owner | Accepted when |
|---|---|---|
| V5 | "Show every editor in the free web editor" | A game made from the packed tools outside the workspace opens Feel and Audio editable; `docs/guides/editor.md` no longer says "2D editors only"; no page says "build" to a person |
| V8 (HUD) | In-game text (PR #524/#526) | A HUD drawn at the top left shows in full under the desktop top bar |
| V15 | Shared editors fixes (M3) | `automata check` on a story and a 3D game made in the workspace passes; consumer smoke runs both under `AF_BETA_STORY` and `AF_BETA_3D` |
| V16 | The merge thread | After #521 and #522 meet, a new game plays its try-it level and its Tuner change |
| V18 | Editors v2 build | Characters and Levels 3D show words, not ids; Levels 3D's tool row fits at 1280 px |

**V19.** The style check's plan-comment rule also catches "plan D-2" and "plan 16.2" forms, and runs over
`packages/editor-3d/src` too. The 19 comments it finds today say why instead.

## 13. Proof

The pipeline's bar is the audit's own: a customer journey, run end to end. After the build, a fresh agent, given only
the copied prompt, makes a game from the packed tools outside the workspace, has the Automata plugin offered and used,
adds a coin a person places in Levels and tunes in the Tuner, plays it, reloads, closes and reopens the editor, and
publishes. The coin is picked up where the picture touches it. Each step's screen is kept.
