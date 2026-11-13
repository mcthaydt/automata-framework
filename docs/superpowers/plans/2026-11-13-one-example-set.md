# One example set, a single place and a single cast: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task, one
> session per branch, with no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the 3D examples become one small world with three people in it, each example that world with one thing
switched on, every file of it content an editor opens; the old 3D examples are deleted as their replacements land.

**Architecture:** the place and the cast are one private workspace package of content, `examples/set-3d`
(`@af-examples/set-3d`), with a single entry, `scene(options)`, that returns a game definition. Each example is one file
in `examples/3d/scene/` that calls `scene` and adds its one thing from a published kit. The story game in
`examples/3d-story` is the same content with everything on. What the content kinds cannot say today (a painted character,
a whole-pixel field, a look read from a file) is added to the framework first, test first, for every game; the
character kind is its own part (Part K), shared with the reference game.

**Tech stack:** TypeScript, PixiJS 8 with `@pixi/3d`, Koota behind the sim facade, Zod, Vitest, Playwright, pnpm, turbo,
Biome. Markdown is not formatted by a tool.

**Spec:** [`../specs/2026-11-13-one-example-set-design.md`](../specs/2026-11-13-one-example-set-design.md).
**Survey (the measurements this plan argues from):**
[`../audits/2026-11-13-example-set-survey.md`](../audits/2026-11-13-example-set-survey.md).

## Tracking

"Now" in the Start column means the task needs nothing that is not on `main` today.

| Task | Part | Branch | Sessions | Model | Start | State | % |
|---|---|---|---|---|---|---|---|
| F1 The set's shape: the catalog, the package, the entry | 0 | `claude/example-set-shape` | 1 | Sonnet | **now** | not started | 0% |
| F2 A whole-pixel field and a look file, in the framework | 0 | `claude/example-set-field` | 1 | Sonnet | after the joined prologue branch | not started | 0% |
| F3 The site can show a 3D example (the mechanism, on fixtures) | 0 | `claude/example-set-site` | 1 | Sonnet | **now**, after F1 | not started | 0% |
| F4 The site shows the set | 0 | `claude/example-set-site` | 1 | Sonnet | after ship-3d B10, `pixi-3d-public`, E1 | not started | 0% |
| W1 Two photos and their swatches | 1 | `claude/example-set-props` | 0.5 | Sonnet | **now** | not started | 0% |
| W2 Track and platform props | 1 | `claude/example-set-props` | 1 | Sonnet | **now** | not started | 0% |
| W3 Indoor props and the platform lamp | 1 | `claude/example-set-props` | 0.5 | Sonnet | **now** | not started | 0% |
| L1 The level: rooms, walls, doors, the fit | 1 | `claude/example-set-place` | 1 | Opus | after the joined prologue branch, F1, W3 | not started | 0% |
| L2 Dressed by day | 1 | `claude/example-set-place` | 2 | Opus | after L1 | not started | 0% |
| L3 Night, lamps and sky | 1 | `claude/example-set-place` | 1 | Opus | after L2 and the night fix | not started | 0% |
| L4 The views, at the scale rule | 1 | `claude/example-set-place` | 1 | Opus | after L3, F2 | not started | 0% |
| K1 A character is a content file | K | `claude/character-data` | 1 | Sonnet | after the joined prologue branch | not started | 0% |
| K2 The wardrobe says what each thing takes | K | `claude/character-data` | 1 | Sonnet | after K1 | not started | 0% |
| K3 Characters opens and draws a character file | K | `claude/character-data-studio` | 2 | Sonnet | after K2, editors v2 tasks 2 to 4 | not started | 0% |
| K4 Characters edits one, on a phone | K | `claude/character-data-studio` | 2 | Sonnet | after K3 | not started | 0% |
| C2 Two things to hold and a pose | 2 | `claude/example-set-holds` | 1 | Sonnet | **now** (the pose after F1) | not started | 0% |
| C3 The traveller | 2 | `claude/example-set-cast` | 1 | Opus | after K1, C2 | not started | 0% |
| C4 The stationmaster and the porter | 2 | `claude/example-set-cast` | 1 | Opus | after C3 | not started | 0% |
| C5 The cast in the place | 2 | `claude/example-set-cast` | 1 | Opus | after C4, L4 | not started | 0% |
| E1 `scene-camera`, and the journeys' harness | 3 | `claude/example-set-examples-a` | 1 | Sonnet | after the Owner's yes, ship-3d B10 | not started | 0% |
| E2 `scene-light` | 3 | `claude/example-set-examples-a` | 0.5 | Sonnet | after E1 | not started | 0% |
| E3 `scene-looks` | 3 | `claude/example-set-examples-a` | 0.5 | Sonnet | after E1 | not started | 0% |
| E4 `scene-props` | 3 | `claude/example-set-examples-a` | 0.5 | Sonnet | after E1 | not started | 0% |
| E5 `scene-people` | 3 | `claude/example-set-examples-b` | 1 | Sonnet | after E1 | not started | 0% |
| E6 `scene-wardrobe` | 3 | `claude/example-set-examples-b` | 0.5 | Sonnet | after E1 | not started | 0% |
| E7 `scene-use` | 3 | `claude/example-set-examples-b` | 0.5 | Sonnet | after E1; `interact` and `hud` built | not started | 0% |
| E8 `scene-cutscene` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | after E1 | not started | 0% |
| E9 `scene-talk` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | after E1 | not started | 0% |
| E10 `scene-puzzle` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | after E1 | not started | 0% |
| E11 `scene-watch` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | after E7 | not started | 0% |
| E12 `scene-dark` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | after E7 | not started | 0% |
| E13 `scene-sound` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | after E1 | not started | 0% |
| E14 The story: the place played end to end | 3 | `claude/example-set-story` | 2 | Sonnet | after E2 to E13 | not started | 0% |
| E15 The sweep: nothing names an old example | 3 | `claude/example-set-story` | 1 | Sonnet | after E14 | not started | 0% |
| S1 Every file has a row and round-trips in Node | 4 | `claude/example-set-editors` | 1 | Sonnet | after E14, K3 | not started | 0% |
| S2 A whole number stays a whole number | 4 | `claude/example-set-editors` | 0.5 | Sonnet | after editors v2 tasks 2 to 4 | not started | 0% |
| S3 A tap on a prop selects the prop | 4 | `claude/example-set-editors` | 1 | Sonnet | after editors v2 tasks 2 to 4, L2 | not started | 0% |
| S5 A journey for each editor | 4 | `claude/example-set-editors` | 2 | Sonnet | after v2 task 6, S1 to S3, K4 | not started | 0% |
| O1 The sheets for the Owner | Owner | `claude/example-set-sheets` | 1 | Opus | after L4, C5 | not started | 0% |

Progress: 0 of 39 tasks (0%). Per part: 0 of 4 (Part 0), 0 of 7 (Part 1), 0 of 4 (Part K), 0 of 4 (Part 2), 0 of 15
(Part 3), 0 of 4 (Part 4), 0 of 1 (the Owner's sheets). Part 5 (2D) has no tasks until the Owner says yes. Sessions:
37 (28 Sonnet at high effort, 9 Opus at medium), before audits and fixes. (There is no task C1 or S4: they became
Part K, which is planned once for this set and for the game.)

## Order and dependencies

```
now, on main ──► F1 (shape) ──► F3 (the site's mechanism, on fixtures)
now, on main ──► W1 W2 W3 (kit props)          now, on main ──► C2 (two items; the pose after F1)
the joined prologue branch on main ──► F2 (field, look file)
                                   ──► K1 ─► K2 ─► [v2 tasks 2-4] ─► K3 ─► K4        (Part K: also the game's)
                                   ──► L1 ─► L2 ─► [night fix] L3 ─► [F2] L4 ─┐
                                        K1 + C2 ─► C3 ─► C4 ───────────────────┴─► C5 ─► O1 ─► the Owner's yes
the Owner's yes + ship-3d B10 (kits public, with interact and hud) ──► E1 ─► E2…E13 (three branches) ─► E14 ─► E15
ship-3d B10 + pixi-3d-public + E1 ──► F4 (the site shows the set)
editors v2 tasks 2-4 ──► S2, S3 ;  E14 + K3 ──► S1 ;  v2 task 6 + S1…S3 + K4 ──► S5
```

**The base (the coordinator's ruling, 2026-11-13).** No task is built on `claude/last-light-camera` or
`claude/last-light-ada` directly. Camera and ada have diverged (9 and 22 commits the other lacks; 59 and 61 changed
files in `character-kit`, 58 and 42 in `packages/3d`), so a branch stacked on them would merge both itself and be
rebuilt when they land, and every look frame taken before that would be taken again. Place and cast tasks start from
`main` **after the joined prologue branch has merged**. A session checks the features it needs are on `main` before
it starts, with these commands (each must print a line; none printing is a stop, not a reason to merge a branch in):

| Feature | Needed by | Check, on `main` |
|---|---|---|
| A view's `lensMm`, `focusBounds`, `lead`, `peekReach`, `yawDeg`, `rotate` | L4, E1 | `git grep -n "peekReach" packages/3d/src/features/camera/sim/camera-view.schema.ts` |
| `fitFocus` and the occluder rule | L4 | `git grep -n "export function fitFocus" packages/3d/src/features/camera/play-fit.ts` |
| `paintedFigure`'s `density`, `grid`, `dimmest`, `holdSkinHue` | F2, K1, C3 to C5 | `git grep -n "dimmest" extensions/character-kit/src/features/painted/painted-view.ts` |
| The garments and hair the game's branch added (`shirt`, `bobOpen`) | K1, K2 | `git grep -n "bobOpen" extensions/character-kit/src/features/fashion/hair.ts` |
| The lcd-panel's screen filter (`[lcdScreen]`) | F2, E3 | `git grep -n "cellPixels" extensions/lcd-panel/src` |
| Night darker than day | L3, E2 | `git merge-base --is-ancestor d246fb8f1 main && echo night-fix` (or its squashed commit: `git log --oneline main --grep "focus the haze on the player"`) |

**What starts now, from `main` today** (marked **now** in the table): pure content and kit props that need none of
the above.

- **F1**: `tooling/examples-runner` and a new folder; the game's branches change 6 files under `tooling` and
  `examples` between them, none of them the catalog. **F3** follows it on fixtures, and ships nothing 3D.
- **W1 to W3**: the seven prop generators, the lamp preset and the two CC0 photos. New files in
  `extensions/world-kit` and one line each in `register-props.ts`, `props.json`, `swatches.json`, `photos.json`.
- **C2**: the items `suitcase` and `handLamp` (library data in `extensions/figures`) and the pose `pullLever` (a
  content file, once F1 has made the folder).

**What waits, and on what:**

- **F2, Part K, every Opus task:** the joined prologue branch on `main` (the table above); L3 also the night fix.
- **Every example (E1 on):** ship-3d B10, so that it imports the kits as built packages a stranger can install, and
  **the Owner's yes** on the sheets (O1), so that no journey or picture is made of a place he has not seen.
- **F4:** B10 and `claude/pixi-3d-public` (the site may not show 3D before both), and E1.
- **K3, K4, S2, S3:** the editors v2 landing's tasks 2 to 4 (v2 rewrites the editors' pages; a fix made before it is
  made twice). **S5:** v2's task 6, the one page that holds every editor.
- **The scope rename** may land at any point. Every task writes a package name only as a whole literal
  (`@automata/<name>`), never joined from pieces, so the codemod rewrites it. `@af-examples/*` is not renamed.

### Dependencies on other plans (for the coordinator to carry)

| Plan | What this set needs it to do | Why |
|---|---|---|
| 3D ship plan, Part B | **Add `@automata/interact` and `@automata/hud` to the publish list** (two more kit recipes, and B10's join) | They were kept private only because nothing public imported them. The example set is public: an example a stranger can open imports only packages a stranger can install. `scene-use`, `scene-dark` and the story import both. Their own dependencies are public after B10 (`interact`: `3d`, `nav`, `puzzle`; `hud`: `content`, `narrative`, `puzzle`). |
| 3D ship plan, Part B | Nothing else: every other package an example imports is already on its list (`3d`, `world-kit`, `lcd-panel`, `retro-crisp`, `character-kit` with `figures` behind it, `sectors`, `places`, `nav`, `systems`, `narrative`, `cutscenes`) or public today (`puzzle`, `audio-synth`, `feel`) | Checked against each example's row in Part 3 |
| 3D ship plan, B5 | `@automata/character-kit`'s published surface includes Part K's `characterFileSchema`, `charactersOf`, `paintedFromFile` if K1 lands first; if B5 lands first, K1 adds them with a `patch` changeset | One kind, one package |
| The game's plan (The Last Light) | Convert Ada and the nurse to character files **with Part K's kind**, after K1; give its `PLAY_FIGURE`, `fieldFor`, `wholeScaleFor` and look wiring up for F2's and K1's framework versions | The Owner: "Ada should be data, characters should be an editor too right?" The kind is planned once, here |
| Editors v2 landing | Tasks 2 to 4 before K3, K4, S2, S3; task 6 before S5 | The editors' pages change under v2 |

**In parallel, by folder** (no two own one file):

| Branch | Owns |
|---|---|
| `claude/example-set-shape` | `tooling/examples-runner/src/catalog.ts` and its test; `examples/set-3d/` (skeleton: `package.json`, `src/`, `tests/unit/shape/`) |
| `claude/example-set-props` | `extensions/world-kit/` |
| `claude/example-set-holds` | `extensions/figures/src/shared/outfit/library/items.json` and its test; `examples/set-3d/content/figure-poses/` |
| `claude/example-set-field` | `extensions/retro-crisp/src`, `packages/3d/src/features/look` |
| `claude/character-data` | `extensions/character-kit/src` and `tests`, the registries in `extensions/figures/src/shared` (but for `items.json`) |
| `claude/character-data-studio` | `packages/editor-3d/src/features/studio` and its tests |
| `claude/example-set-place` | `examples/set-3d/content/levels`, `content/world-*`, `content/look.toml`, `tests/unit/place/` |
| `claude/example-set-cast` | `examples/set-3d/content/characters`, `tests/unit/cast/`; C5 alone adds the level's `cast` block, after `-place` has merged |
| `claude/example-set-examples-a`, `-b`, `-c` | each its own files in `examples/3d/scene/` and `examples/3d/tests/e2e/`, the old files it deletes, and its own content folders in `examples/set-3d/content` (named per task). `examples/README.md` and `examples/3d/README.md` are regenerated by one command (E1 adds it), never edited by hand, so three branches do not collide on them |
| `claude/example-set-editors` | `packages/editor`, `packages/editor-3d/src/features/levels-3d`, `extensions/editors`, `examples/set-3d/content/editors.toml`, `examples/3d-story/tests/e2e/editors/` |
| `claude/example-set-site` | `site/` |
| `claude/example-set-story` | `examples/3d-story/` but for `tests/e2e/editors/` |

**The critical path:** the joined prologue branch on `main` → K1 → C3, C4 → C5 → O1 → the Owner's yes → E1 → E14 →
S1 → S5. The longest waits this plan does not control are the joined prologue branch (gates K1 and the place) and
ship-3d B10 (gates E1).

**The honest total:** 37 build sessions (9 of them Opus look sessions), plus the plan audit (1), implementation
audits (about 4) and fixes (about 4): **about 46 sessions**. Six of the 37 are Part K, which the game's lane would
otherwise have to plan and pay for itself. With the props, the shape, the site's mechanism and the holds starting now,
and three example branches in parallel later, the calendar is shorter than the count.

## The place (the only place-specific section)

Everything that depends on the place being a railway station is here. A different place swaps in by rewriting this
section and the content it names; no task outside Part 1's W tasks and the content tasks changes shape. The package,
the entry, the module (`scene`), the example ids and the journeys carry no place name.

**A small country railway station at the end of the line.** One level, `examples/set-3d/content/levels/station.af-sector.json`,
`name = "station"`, five zones (a sector's `zone`):

| Zone id | What it is | Kind of spot (what any place must offer) | Size, about |
|---|---|---|---|
| `platform` | The platform, the track, the canopy, fields and hills behind | outdoors, sky, a long walk, room for the camera to turn | 24 × 6 m, track 4 m beyond |
| `waitingRoom` | Benches, a stove, a clock, a noticeboard, things left behind | a furnished room with things to use | 6 × 5 m |
| `ticketOffice` | A counter with a window, the stationmaster behind it | a person behind a counter | 4 × 4 m |
| `signalBox` | A lever frame, signal lamps seen through the window | a machine with switches and lamps | 3 × 4 m, up three steps |
| `storeRoom` | Shelves, trunks, a locked door, no window | a locked, dark room | 3 × 4 m |

Doors: platform to waiting room, waiting room to ticket office (a door) and to the platform, platform to signal box,
waiting room to store room (locked; the key is in the ticket office's `keyCabinet`).

**Props the place needs that the kit lacks** (W1 to W3 make them, in the world kit, for every game): photos `ballast`,
`sleeper`; generators `rails`, `platformEdge`, `canopy`, `signal`, `ticketWindow`, `leverFrame`, `trunk`; preset
`lamp.platform`. Everything else is in the kit (survey, section 2).

**The cast** (`examples/set-3d/content/characters/`):

| File | Who | Wears (the kit's garments) | Hair, gait | Holds, does |
|---|---|---|---|---|
| `traveller.toml` | The one you walk | `coat` (long), `trousers`, `shoes` with `boots` | `bob`, `brisk` | `suitcase`; stands `handInPocket` |
| `stationmaster.toml` | Behind the counter | `jacket` with `inner`, `waistcoat`, `trousers`, `cap` style `peakedCap` with its `mark` | `crop`, `still` | stands `handInJacketPocket`; action `nod`, `point` |
| `porter.toml` | On the platform and in the signal box | `tee` with long sleeves, `waistcoat`, `trousers`, `cap` style `flat` | `shortFade`, `loose` | `handLamp`; pose `pullLever`; seat `slump` on the bench |

**Where each example happens:** the "Where" and "Cast" columns of Part 3's table.

**The story (E14):** the traveller arrives on the last train at dusk; the waiting room is cold; the stationmaster sells
no ticket until the line is clear; the porter is asleep on the bench; the signal box's levers set the line; the key in
the cabinet opens the store room, where the porter's lamp oil is; the lamp lit, the porter clears the signal and the
morning train comes. Six beats, about five minutes.

## What this plan settles

1. **One content package, one entry.** `examples/set-3d` holds the content and `src/app/scene.ts`. An example may import
   it: the catalog allows exactly that one workspace name beside the published entries (F1). The kits are still imported
   by their published names, as a stranger would.
2. **Folders and package names that workflows name are kept.** `examples/3d` (`@af-examples/examples-3d`) and
   `examples/3d-story` (`@af-examples/3d-story`) stay, with new contents, so `.github/workflows/3d.yml` is not edited.
3. **Thirteen examples replace twenty-one**, and the story replaces the story (Part 3).
4. **A 3D example's site page shows the built example in a frame beside its code and words**, not the in-browser
   compiler: the playground's runtime is three files under a 460 000 B budget and holds no 3D (survey, section 3).
5. **The set's sounds are synth voices only**, so the Audio editor shows them truly (stress row 4 is not met).
6. **Files with no editor yet are kept few and listed** (S1): `look.toml`, the HUD file and storylets. They are read as
   text by the editors' home page; the set does not wait for editors nobody has planned.

## Rulings and questions for the coordinator

**Ruled by the coordinator, 2026-11-13, on the survey** (the plan follows each):

- `interact` and `hud` are planned in, and join the 3D lane's publish list (the Dependencies table above).
- The set's site pages are their own early task (F3), then switched on (F4).
- `examples/3d` and `examples/3d-story` keep their folders and package names; no workflow file changes.
- Nothing is built on the camera or ada branches; place and cast start from `main` after the joined prologue branch;
  kit props, the two items and the pose start now.
- A painted character as a content kind that Characters opens is planned once, as Part K, for this set and the game.

**Still open, with the answer this plan takes:**

| # | Question | Recommended answer (the plan assumes it) |
|---|---|---|
| Q1 | The spec says examples import the kits "as a stranger would". May an example also import the set's own workspace package, which a stranger cannot install? | Yes. The kits come by published name; the place is content, and the page says "the station is in `examples/set-3d`; copy the folder". The alternative, each example carrying the level inline, breaks "small enough to read in a minute". |
| Q3 | `fieldFor`, `wholeScaleFor` and the passes wired from `look.toml` are code in `games/the-last-light/src/app`. The set may borrow nothing from the game. | F2 puts them in the framework for everyone (`@automata/retro-crisp` for the field, a `look` reader in `@automata/3d`). If the game's lane lifts them first, F2 becomes "use what landed" and loses its session. |
| Q4 | Who closes stress row 2 (a tap on a prop selects the room)? No plan in flight owns it. | This plan, as S3, on the editors branch after v2. If the editors lane takes it, S3 leaves this plan and S5 waits on that lane. |
| Q5 | Rule 5 says every file opens in its editor. `look.toml`, the HUD file and storylets have no editor (stress rows 12, 15, 16). | The set lists them as "no editor yet" (S1's test names exactly three files) and the home page shows them as text. A schema form for small files is the editors lane's, not this plan's. |
| Q6 | `examples/3d/wardrobe` shows how to write a garment extension, and `worldkit-generated-map` shows `generateMap`. Neither fits one place and one cast. | Both are deleted with E6 and E4 and not replaced: the kits' READMEs keep "Add your own" and "Make a whole place". Rule 1 forbids keeping an old example because nothing replaced it. |
| Q7 | The examples' ids carry no place name (`scene-camera`), so a different place does not rename thirteen pages. | Keep it. If the Owner wants the place in the name, it is one rename in F1 before any page exists. |
| Q8 | The old journeys run on landscape phones only. Rule 4 says phone first. | The new journeys run portrait (`Pixel 7`, `iPhone 14`) and landscape; portrait is the design size. |
| Q9 | Part K's branch and tracker row: under this workstream or its own? | Its own row, shared by this set and the game, with this plan as its home until the coordinator moves it. |

## Global constraints

- The Owner, 2026-11-13: "the 3D examples should be a unique set, a single environment, a single set of characters";
  "no need to grade work we're throwing away". **No task reviews, shoots, grades, describes or ports an old example.**
  A task that deletes one reads only its file name.
- **A stranger can install everything an example imports** (the coordinator, 2026-11-13). An example imports the
  umbrella, Zod, published kits and the set's own content package, nothing else.
- **Replace, do not grade (rule 1).** An old example, its journey and its picture are deleted in the commit that lands
  its replacement. Part 3's table says which.
- **Data first (rule 2).** The level, the cast, poses, the cutscene, words, rules, sounds and feel are files under
  `examples/set-3d/content`. An example file has at most 40 code lines (the catalog's count; F1 sets this for the
  `scene` module), a header, and no relative import.
- **One look (rule 3).** One `content/look.toml`, the DUEL palette, the ui kit's buttons and prompts. An example never
  sets a colour.
- **Phone first (rule 4).** Designed at 390 × 844. Touch targets at least 44 px, the primary action 48 px. What to press
  is said in words on the button.
- **Photo surfaces across the board.** Every swatch the place uses is a photo-made tile. No asset is drawn by hand,
  made by a service or bought. A new photo is CC0 with its source, licence and credit in `photos.json`.
- **Nothing from The Last Light:** no file, model, swatch, line or number is copied from `games/the-last-light`.
- **Pictures.** No picture is recorded (`screenshots-approved.json`, a golden, a site picture) before the Owner has
  seen the sheets and said yes (O1). Until then a journey asserts state and measures, and writes frames only to
  `test-results/`.
- **Look sessions (L1 to L4, C3 to C5, O1) run on Opus at medium effort** and obey one rule: the session opens every
  frame it reports, with the Read tool, and says what it saw; a frame it did not open is not reported.
- The laws of `AGENTS.md` hold: the sim has no I/O, clock or `Math.random`; Zod only; a source file has at most 600
  lines; kebab-case names with role suffixes; comments say why and name no plan; a test imports `#src/…`.
- A hash that moves is investigated. W1 to W3, F2, K1, K2 and C2 add to kits: they move no existing golden, tile or hash.

### The gates, for every task

`pnpm format`, then `pnpm check` (exit 0). After a change to a published package's exports or doc comments:
`pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, and commit what they write. A published package
that changes gets a `patch` changeset; `examples/` gets none. 3D browser suites and journeys:
`pnpm test:browser:3d` and `pnpm test:journeys:3d`, run where the session can and named as pending otherwise. Report
what ran, what did not, and what is pending. Never `--no-verify`; stage files by path.

## Review focus

1. A phone held upright: the field is letterboxed above the controls and the primary button is still 48 px and on
   screen (E1's portrait journey measures its box; every example inherits the layout).
2. A level edited in Levels 3D and saved: the file is byte-identical when nothing changed, and a prop the editor has no
   form for (`with`, `fit`) is kept (S1's Node round-trip over every content file).
3. A character file with an unknown garment, swatch or pose name: the game refuses to start and names the file and the
   word, never draws a bare figure (K1's test).
4. Reduced motion asked for: rain, stars and the cutscene's camera drift stand still and the example still reaches its
   moment (E2's and E8's journeys run once with `reducedMotion: 'reduce'`).
5. A save refused by the host: `scene-dark` says so in words and does not write to device storage (E12's journey with
   `Host: grant=`).

---

## Part 0: the shape, and what the framework lacks

### Task F1: The set's shape: the catalog, the package, the entry

**Files:**
- Modify: `tooling/examples-runner/src/catalog.ts` (module lists, the import rule, the line budget), `tooling/examples-runner/tests/unit/catalog.test.ts`
- Create: `examples/set-3d/package.json` (`@af-examples/set-3d`, private, `exports: { ".": "./src/entries/index.ts" }`, `imports: { "#src/*": "./src/*" }`), `tsconfig.json`, `vitest.config.ts`, `src/entries/index.ts`, `src/app/scene.ts`, `src/app/scene-options.ts`, `content/editors.toml`, `tests/unit/shape/scene.test.ts`
- Modify: `pnpm-workspace.yaml` (add `examples/set-3d`), `knip.jsonc`, `examples/3d/package.json` (dependency `@af-examples/set-3d`)

**Interfaces, produced (every later task relies on these names):**

```ts
export type SceneZone = string // a zone id of the level; the place section lists them
export type SceneCast = string // a character file's id
export interface SceneOptions {
  readonly start: SceneZone
  readonly cast?: readonly SceneCast[] // default: the walked character only
  readonly time?: 'day' | 'dusk' | 'night' // default 'day'
  readonly extensions?: readonly Extension[] // the example's one thing
  readonly on?: (scene: SceneContext) => void // the example's few lines
}
export interface SceneContext { readonly world: World; readonly level: AfSector2; readonly probe: SceneProbe }
export interface SceneProbe { zone(): SceneZone; time(): string; fact(name: string): unknown; carried(): readonly string[] }
export function scene(options: SceneOptions): GameDefinition
export const SCENE_ZONES: readonly SceneZone[]
export const SCENE_CAST: readonly SceneCast[]
```

- [ ] **Step 1: the failing catalog tests.** In `catalog.test.ts`, with a fixture folder: (a) `scene/scene-camera.ts`
  importing `@af-examples/set-3d` and `@automata/framework` has no problems; (b) a `scene` file with 41 code lines has
  the problem `41 code lines, more than 40`; (c) a `scene` file importing `@automata/lcd-panel` with `Tier: extension`
  and one importing only the umbrella with `Tier: core` both pass (the tier follows the imports in this module);
  (d) a file in any other module importing `@af-examples/set-3d` has the problem
  `import "@af-examples/set-3d" is not a public entry`.
  Run `pnpm --filter @automata/examples-runner test -- catalog`. Expected: FAIL, `"scene" is not a module`.
- [ ] **Step 2:** add `SET_MODULE = 'scene'`, `SET_PACKAGE = '@af-examples/set-3d'`, `SET_CODE_LINE_BUDGET = 40` and
  the three rules to `catalog.ts`. Run the test. Expected: PASS.
- [ ] **Step 3: the failing shape test.** `scene.test.ts`: `scene({ start: 'nowhere' })` throws
  `There is no zone called "nowhere". The zones are: …`; `scene({ start: SCENE_ZONES[0] })` returns a definition whose
  extensions include `render3dExtension`; `SCENE_ZONES` equals the zones read from the level file. The skeleton ships
  with a one-room level (`content/levels/station.af-sector.json`, one sector, zone `platform`) so the test has a file;
  L1 replaces it. Run `pnpm --filter @af-examples/set-3d test`. Expected: FAIL, the module does not exist.
- [ ] **Step 4:** write `scene.ts` (content through the content compiler, as a game does; no fetch by hand) and the
  probe. Run. Expected: PASS.
- [ ] **Step 5:** gates; commit `feat(examples): the example set's package, its one entry and the catalog's rule for it`.

**Done means:** both tests pass; `pnpm check` exit 0; no file under `examples/3d` or `examples/3d-story` changed but
`examples/3d/package.json`.

### Task F2: A whole-pixel field and a look file, in the framework

Branch `claude/example-set-field`. Waits for the joined prologue branch on `main` (the checks for `dimmest` and `cellPixels`). If the game's lane has already lifted these (Q3), tick this task with the commit that did.

**Files:**
- Create: `extensions/retro-crisp/src/features/crisp/whole-field.ts`, `extensions/retro-crisp/tests/unit/crisp/whole-field.test.ts`
- Create: `packages/3d/src/features/look/look-file.schema.ts`, `packages/3d/src/features/look/look-file.ts`, `packages/3d/tests/unit/look/look-file.test.ts`
- Modify: `extensions/retro-crisp/src/entries/index.ts`, `packages/3d/src/entries/index.ts`

**Interfaces, produced:**

```ts
// @automata/retro-crisp
export function wholeScaleFor(window: { width: number; height: number }, devicePixelRatio: number, cap?: Size): number
export function fieldFor(window: { width: number; height: number }, devicePixelRatio: number, cap?: Size): Size
// @automata/3d
export const lookFileSchema: z.ZodType<LookFile> // [field] cap, [light] lamps and contact, [figure] density, grid, dimmest, holdSkinHue; loose for passes' own tables
export function readLook(content: Content): LookFile
```

- [ ] **Step 1: failing tests.** `whole-field.test.ts`: for windows 390 × 844 at ratio 3, 844 × 390 at 3, 1024 × 768 at
  1 and 1920 × 1080 at 1, `fieldFor` times `wholeScaleFor` is at most the window in device pixels and at least 80% of
  its short side, the scale is an integer, and the field never passes the cap. `look-file.test.ts`: a `look.toml` with
  `[figure] density = 2, grid = true` parses; `density = 3` is refused with the path `figure.density`; an unknown
  table is kept (a pass's own settings). Run both. Expected: FAIL, modules missing.
- [ ] **Step 2:** write the two modules (the rule, not the game's file: whole device pixels per field pixel, rounded
  down while the picture still fills 80% of the window). Run. Expected: PASS.
- [ ] **Step 3:** doc comments on every export; `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`; a
  `patch` changeset for each package if it is public by then; gates; commit.

**Done means:** both suites pass; no existing golden moved (`git status` shows no recorded file changed).

### Task F3: The site can show a 3D example (the mechanism, on fixtures)

Starts now, after F1. It ships nothing 3D: until F4 the reader returns no entry on the real folder, because
`playgroundCatalog`'s rule (an example that imports an unpublished package is left out) is kept.

**What the 2D pages' mechanism is reused for, and what is not:**

| Reused as it is | From |
|---|---|
| Finding examples and reading a header into a title, the words (`Shows`) and the controls | `readCatalog`, `parseHeader` (`@automata/examples-runner`) |
| Leaving out an example a stranger could not install | `isUnpublishedExtension` in `playgroundCatalog` |
| The page's frame: title, words, controls, the code block with highlighting, the groups on the index and the home's strip | `ExamplePage.svelte`, `ExamplesIndex.svelte`, `example-catalog.ts`, `HomeExamples.svelte`, `highlight.ts` |
| A game shown whole in a frame under the site's frame headers and the fake host | the demos (`build-demos.ts`, `DemoRunner.svelte`, `site/playground/src/ruken/`) |
| Stills, and the Owner's approval before one is used | `take-pictures.ts`, `screenshots-approved.json` |

| Not reused | Why |
|---|---|
| Compiling the example in the browser and editing its code (`compile.worker.ts`, `CodePanel.svelte`, the import map) | The runtime is three files under a 460 000 B gzip budget and holds no 3D; a 3D example's page shows its code read-only |
| The determinism row and the golden replay | A `scene` example has no `Golden:` header; the story's hash is checked in its own journey (E14) |

**Files:**
- Modify: `site/src/shared/framework/examples.ts` (a second reader, `sceneExamples(root, dir?)`), `site/src/shared/framework/example-catalog.ts` (a group, "One small world, in 3D"), `site/scripts/build-demos.ts` (`buildScenes()`: one `vite build` of the examples folder into `static/scenes/`, skipped when the reader returns none), `site/src/features/examples/ExamplePage.svelte` and `ExamplesIndex.svelte`, `site/src/features/home/HomeExamples.svelte`
- Create: `site/src/features/examples/SceneFrame.svelte`, `site/tests/unit/framework/scene-examples.test.ts`, `site/tests/fixtures/scene-examples/` (two tiny `scene` files, one importing only public names and one importing a private one), `site/tests/e2e/scene-examples.e2e.ts`

- [ ] **Step 1: failing unit test.** Over the fixture folder, `sceneExamples()` returns one entry for the public
  example with `id`, `title`, `shows`, `controls`, `source` and `frameUrl = /scenes/<name>/index.html`, and none for
  the private one; over the real `examples/3d` today it returns `[]`. Run
  `pnpm --filter @automata/site test -- scene-examples`. Expected: FAIL, `sceneExamples` is not exported.
- [ ] **Step 2:** the reader, the build step, and `SceneFrame.svelte`: a still (or a plain panel with the title when
  there is none) and one Play button, 48 px high, that says "Play"; the frame loads only when it is pressed, so a
  phone on a slow line pays for 3D only when asked; under the frame, one line of what to press (the header's
  `Controls`); then the code.
- [ ] **Step 3: failing e2e, then green**, on a build made with the fixture folder (an env var names it, read only by
  the test's build): at 390 × 844 and 1280 × 800 the page shows the words above the frame, has no horizontal scroll,
  the Play button's box is at least 48 px and inside the viewport, focus moves into the frame on Play and back out
  with Escape, and the words pass the copy check `pnpm check:site` already runs.
- [ ] **Step 4:** gates (`pnpm build && pnpm check:site`, the site's unit tests); commit.

**Done means:** the mechanism is proved on fixtures; the real site build is byte-identical in its page list (0 pages
added: `sceneExamples()` is empty on `main`), which the log records with the two page counts.

### Task F4: The site shows the set

Waits for ship-3d B10, `claude/pixi-3d-public` and E1; run again after E13 and E14 land (no code, a rebuild).

- [ ] **Step 1: failing e2e:** `/examples/scene-camera` exists, and after one tap on Play the frame's canvas has drawn
  (its ready message). Expected before B10: FAIL, a 404.
- [ ] **Step 2:** nothing to write if B10 emptied `UNPUBLISHED_EXTENSIONS`; otherwise stop and say which package is
  still private. Add the story as a demo (`demos.ts`), beside Emberwick.
- [ ] **Step 3:** `pnpm build && pnpm check:site`; `pnpm test:e2e --project chromium`; gates; commit.

**Done means:** every `scene` example whose imports are public and the story have a page; the log records how many
pages changed (expected: the index, the home, one new page per example, one demo).

---

## Part 1: the place

### Task W1: Two photos and their swatches (`claude/example-set-props`)

**Files:** `extensions/world-kit/assets/photos/ballast.jpg`, `sleeper.jpg`, `assets/photos/photos.json`,
`library/swatches.json` (`ballast`, `sleeper`), `library/tiles/` (written by the command), `tests/unit/textures/` (the
existing library test covers new rows).

- [ ] **Step 1:** add the two rows to `photos.json` first (source URL, `licence: "CC0"`, credit) with no file. Run
  `pnpm --filter @automata/world-kit textures:check`. Expected: FAIL, the photo is missing.
- [ ] **Step 2:** add the two CC0 photos (track ballast seen from above; a creosoted timber sleeper's face), the two
  swatches with their `reads`, and run `pnpm --filter @automata/world-kit textures`. Run `textures:check` and
  `pnpm --filter @automata/world-kit test:unit`. Expected: PASS, and `git status` shows only new files and the three
  JSON files changed: no existing tile moved.
- [ ] **Step 3:** gates; commit `feat(world-kit): ballast and sleeper, two CC0 photos and their tiles`.

### Task W2: Track and platform props

**Files:** create `extensions/world-kit/src/features/props/railway.ts`, `tests/unit/props/railway.test.ts`; modify
`src/features/props/register-props.ts`, `library/props.json`, `README.md` (a section "A railway's things").

Generators, each `{ kind }` drawing with no parameters, origin at the centre of its base, front +z:

| Kind | Parameters | Bounds with the defaults (m) |
|---|---|---|
| `rails` | `length` (6), `gauge` (1.435), swatches `rail`, `sleeper`, `bed` | 6 × 0.3 × 2.6 |
| `platformEdge` | `length` (6), `height` (0.9), `line` (true: the white line) | 6 × 0.9 × 0.6 |
| `canopy` | `length` (6), `depth` (3), `posts` (2), `height` (3.2) | 6 × 3.6 × 3 |
| `signal` | `clear` (false: the arm level), `lit` (true), `height` (5) | 1.2 × 5 × 0.5 |

- [ ] **Step 1: the failing test**, in the shape of `tests/unit/props/ward.test.ts`: each kind is registered
  (`resolveProp` is not a fault), builds the same mesh twice, keeps to its bounds within 5%, and obeys its parameters
  (`rails` with `length: 12` is twice as long; `signal` with `clear: true` has its arm's far end higher than with
  `false`; `platformEdge` with `line: false` has fewer pieces). A level of the four passes `checkReads` with no
  `swatch-reads` problem. Run `pnpm --filter @automata/world-kit test:unit -- railway`. Expected: FAIL,
  `unknown-generator`.
- [ ] **Step 2:** write the four generators from `@automata/3d/props-kit`'s pieces (`box`, `rbox`, `rod`, `cylinder`,
  `merge`, `part`); register them; add presets of the same names. Run. Expected: PASS.
- [ ] **Step 3:** gates, changeset if the kit is public by then; commit.

### Task W3: Indoor props and the platform lamp

**Files:** modify `railway.ts`, `railway.test.ts`, `library/props.json`, `README.md`.

| Kind | Parameters | Bounds (m) |
|---|---|---|
| `ticketWindow` | `width` (1.6), `open` (true: the hatch up) | 1.6 × 2.1 × 0.5 |
| `leverFrame` | `levers` (4), `pulled` (`[]`: indexes pulled toward −z) | 1.2 × 1.3 × 0.6 |
| `trunk` | `width` (0.9), `straps` (2) | 0.9 × 0.5 × 0.5 |

Preset `lamp.platform`: core's street lamp at 3.4 m with `lampHead` and a warm bulb.

- [ ] **Step 1: failing test** added to `railway.test.ts`: the three kinds as in W2; `leverFrame` with
  `pulled: [1]` differs from `pulled: []` only in lever 1's pieces; `ticketWindow` with `open: false` is no deeper
  than its counter; the preset `lamp.platform` resolves. Expected: FAIL, `unknown-generator`.
- [ ] **Step 2:** write, register, preset. PASS. **Step 3:** gates; commit.

**Done means (W1 to W3):** the kit's whole suite passes; no existing tile, map or golden changed; the README lists the
seven kinds and their bounds.

### Task L1: The level: rooms, walls, doors, the fit (`claude/example-set-place`, Opus)

Starts from `main` after the joined prologue branch, F1 and W3 have merged.

**Files:** `examples/set-3d/content/levels/station.af-sector.json` (replaces F1's one-room file),
`examples/set-3d/tests/unit/place/level.test.ts`.

- [ ] **Step 1: the failing test.** The level parses with `afSector2FileSchema`; its zones are exactly the five of the
  place section; every door in that section joins the two zones it names (a walker's path exists between each pair,
  through `sectors`' geometry); the store room's door is `locked`; every room's floor fits its walls (the derived fit:
  no corner outside its neighbours' shared edge by more than 1 cm); `automata check` passes in the package. Run
  `pnpm --filter @af-examples/set-3d test -- level`. Expected: FAIL, five zones wanted and one found.
- [ ] **Step 2:** author the rooms, walls, doors, masses (the building's outside, the far bank) and photo swatches at
  the sizes in the place section, by text and in Levels 3D. Run. Expected: PASS.
- [ ] **Step 3: look.** Draw each zone by day from a plain overhead and from eye height (a script in
  `examples/set-3d/scripts/frames.ts`, written here, that renders named views to `out/place/`).
- [ ] **Step 4:** gates; commit.

**What to look at (open every frame):** do the five rooms read as one building beside one track; is each doorway wide
enough for a figure and a camera; does any wall cut the platform's long view; do floor and wall tiles change at
thresholds, not mid-room; is anything the size of a figure wrong against a 1.75 m marker.

### Task L2: Dressed by day (Opus, two sessions: outdoors, then the three rooms and the box)

**Files:** the level's `props`, `lettering`, `decals`, `sky.horizon`; `examples/set-3d/content/world-props/*.toml` and
`world-swatches/*.toml` only where the kit's defaults need the place's colours;
`examples/set-3d/tests/unit/place/dressing.test.ts`.

- [ ] **Step 1: the failing test.** Every prop resolves (`resolveProp` no fault); no prop's bounds cross a wall or
  another prop's by more than 2 cm; each zone has the props the place section names for it (platform: `rails`,
  `platformEdge`, `canopy`, `bench`, `lamp.platform`, `signal`, `post.sign`; waiting room: `chair.row` or `bench`,
  `radiator`, `wallClock`, `noticeboard`; ticket office: `ticketWindow`, `keyCabinet`, `desk`; signal box:
  `leverFrame`; store room: `shelving`, `trunk`, `crate`); `checkReads(level, library, photos)` returns no problem;
  every swatch used has a photo tile. Expected: FAIL, the level has no props.
- [ ] **Step 2:** place the props; set the name board's letters with the level's `lettering`. PASS.
- [ ] **Step 3: look,** each zone by day from its working angle. **Step 4:** gates; commit per zone.

**What to look at:** is the platform readable as a platform at a glance (edge, line, track, canopy); does each room say
what it is without a label; is there a clear floor path a thumb can steer through; do props crowd the doorways; does
any surface read flat or blotchy at the field's size; do the rails meet without a seam; is the palette one palette.

### Task L3: Night, lamps and sky (Opus)

Waits for the night fix on `main`.

**Files:** the level's `lamps`, `time`, `sky`, `look`; `examples/set-3d/content/look.toml` (`[light]`);
`examples/set-3d/tests/unit/place/light.test.ts`.

- [ ] **Step 1: the failing test.** Every zone but the store room has at least one lamp; the store room has none and a
  room `light` at most 0.1; the level names the times `day`, `dusk`, `night` as valid for it; and, in the browser
  project, the platform's frame at `night` has a mean luminance below 0.8 of its frame at `day` (the night fix's own
  measure). Expected: FAIL, no lamps.
- [ ] **Step 2:** lamps (platform lamps, the waiting room's pendant, the office's desk lamp, the box's signal lamps),
  the sky's horizon and layers, haze. PASS.
- [ ] **Step 3: look,** every zone at `day`, `dusk` and `night`. **Step 4:** gates; commit.

**What to look at:** is night darker than day and still playable (can the edge of the platform be seen); does each
lamp light what a person would expect it to; is the store room truly dark with the door shut and legible with it open;
does haze fade the far bank without veiling the platform; does any lamp blow a surface to white.

### Task L4: The views, at the scale rule (Opus)

Waits for the joined prologue branch on `main` (the checks for `peekReach` and `fitFocus`) and F2.

**Files:** the level's `views` and each sector's `view`; `examples/set-3d/content/look.toml` (`[field]`, `[figure]`);
`examples/set-3d/tests/unit/place/views.test.ts`.

- [ ] **Step 1: the failing test.** Each zone names a view; each view parses as a `camera-view`; for each view and each
  of the two reference fields F2's `fieldFor` gives (390 × 844 at ratio 3; 1024 × 768 at 1), a density-2 figure's
  texel at the view's focus is a whole number of field pixels, within 1% (computed from `lensMm`, `distance`,
  `tiltDeg` and the field's height: the same arithmetic `texelRatio` in `@automata/retro-crisp` does); the platform's
  view has `rotate = true` and a `focusBounds` inside the platform; every indoor view's `focusBounds` is inside its
  room; no wall or canopy stands between the camera and the focus anywhere in `focusBounds` unless it is listed as an
  occluder that cuts away. Expected: FAIL, no views.
- [ ] **Step 2:** author the five views (`lensMm` sets the scale; `distance` clears the walls; `lead` on the platform).
  PASS.
- [ ] **Step 3: look,** a figure-height marker walked to the four corners of each `focusBounds`, portrait and
  landscape. **Step 4:** gates; commit.

**What to look at:** is the walked figure the same size in every zone; does the camera ever look at the back of a wall;
on the platform, does a quarter turn still frame the track; in portrait, is the figure above the controls; does a
doorway stay in frame as the figure nears it.

---

## Part K: a character is data (planned once: this set and the game both use it)

The Owner: "Ada should be data, characters should be an editor too right?" Today a painted character is a
`CharacterDef` in TypeScript and Characters opens only core's mesh figures (stress row 3). This part makes a painted
character a content file and makes Characters open, draw and edit it. The set's three people are its first files; the
game converts Ada and the nurse with the same kind, in its own plan.

**What the kind must express.** The hardest case is the game's cast file on `origin/claude/last-light-ada`
(`games/the-last-light/src/features/figures/cast.ts`), read for its field names only. A character file says:

| Group | Fields | Notes |
|---|---|---|
| Who | `id`, `name` | |
| Build | 18 sliders (`frame`, `height`, `muscle`, `fat`, `shoulders`, `hips`, `arms`, `head`, `chunk`, `legs`, `posture`, `age`, `headTilt`, `neck`, `neckLength`, `hands`, `feet`, `faceForward`) | each 0 to 1 but `height` (cm) and `headTilt` (degrees); ranges from the painter |
| Face shape | 14 sliders under `face` (`width`, `jaw`, `chin`, `cheekHeight`, `cheekWidth`, `bridge`, `nose`, `lips`, `browArch`, `browWeight`, `browHeight`, `crease`, `hood`, `liner`) | eye shape is `crease`, `hood`, `liner` |
| Genes set directly | `genes` (for example `headPitch`) | for a figure meant to look wrong |
| Skin | `skin`, a swatch name | |
| Hair | a garment row: colour swatch and `style`; hair physics `stiff`, `damp`, `trail`, `bounce`, `sway`, `hang` | |
| Face paint | a garment row: `eyes`, `lids`, `white`, `brows`, `lips`, each a swatch | lips and eyes are colours here, shape above |
| Face on camera | `camera`, `turn`, `blink`, `drawn` | |
| Outfits | named lists of garment rows, each the garment's name with its swatch and its own parameters (a waistcoat's `fit`, `length`, `armhole`, `open`, `buttons`; jeans' `taper`, `crop`, `turn`; a cap's `style`, `mark`); `default` names one | the same shape as `CharacterDef`'s, so nothing is translated |
| Swatches of its own | by name: a ramp, a base, paint, tones; or the name of a `figure-swatches` file | the game's Ada has her own cloth and lips |
| Gait | a preset's name (the kit's, or a `figure-gaits` file) and any of its numbers changed | the game spreads a whole gait in: a file names it |
| Hand, item, stand, seat | `hand`, `item`, `stand`, `seat` | |
| How it is painted (the hold options) | `[paint]`: `density` (1, 2 or `"auto"`), `holdSkinHue`, `dimmest`, `grid`, `crisp`, `lit` | a game's `look.toml` `[figure]` gives the defaults for all its people (F2); a file overrides them |

**What Characters must show and edit:** the game's character files as cards; one painted figure at its own density,
turned through the 8 directions, standing or walking, at 1× and enlarged at a whole scale, on a ground line with a
1.75 m marker, under a chosen time of day; every group above as a form (sliders with their ranges, choices filled from
the registries, an outfit as a list to add to, remove from and reorder, each garment's own parameters under it, an
outfit switcher, a swatch's ramp); a problem that names the field when the file names something unregistered; a save
that changes only the lines edited.

### Task K1: A character is a content file (`claude/character-data`)

Waits for the joined prologue branch on `main` (the check for `dimmest` and `bobOpen`).

**Files:**
- Create: `extensions/character-kit/src/features/painted/character.schema.ts`, `character.content.ts`, `extensions/character-kit/tests/unit/content/character.test.ts`, `extensions/character-kit/tests/fixtures/characters/plain.toml` and `every-field.toml` (a made-up person who uses every group in the table above; no value is copied from the game)
- Modify: `extensions/character-kit/src/app/character-kit.extension.ts` (the kind `character`, folder `characters`), `src/entries/index.ts`, `README.md`

**Interfaces, produced:**

```ts
export const characterFileSchema: z.ZodType<CharacterFile> // CharacterDef's fields, plus item, stand, seat and [paint]
export function charactersOf(content: Content): ReadonlyMap<string, CharacterFile>
export function characterDefOf(file: CharacterFile, content: Content): CharacterDef // gait and swatch names resolved
export function paintedFromFile(file: CharacterFile, content: Content, defaults?: PaintOptions): FigureView
export function writeCharacter(file: CharacterFile, original: string): string // changes only the lines that differ
```

- [ ] **Step 1: the failing test.** (a) `plain.toml` parses and `paintedFromFile` paints the same cell, texel for
  texel, as `paintedFigure` given the same definition in TypeScript, in the 8 directions; (b) `every-field.toml`
  parses, and `characterDefOf` returns a definition with every group set (one assertion a group); (c) a file naming
  the garment `cloak` is refused with `content/characters/plain.toml: outfits.default[1]: No garment called "cloak"
  is registered`, and the same shape of message for an unknown swatch, gait, hair style, cap style, item, stand and
  seat; (d) `[paint] density = 3` is refused at `paint.density`; (e) with no `[paint]`, the game's defaults apply, and
  the file's `[paint]` wins over them; (f) `writeCharacter(parse(text), text)` is `text`, byte for byte, for both
  fixtures, and changing one slider changes one line. Run
  `pnpm --filter @automata/character-kit test:unit -- character`. Expected: FAIL, the module does not exist.
- [ ] **Step 2:** the schema (written types on every export), the kind, the reader, the writer. PASS, and the kit's
  goldens unmoved.
- [ ] **Step 3:** the README's section "A character as a file", with `plain.toml` in it; `pnpm build`,
  `pnpm api-report --update`, `pnpm api-index --write`; a `patch` changeset if the kit is public; gates; commit
  `feat(character-kit): a painted character is a content file`.

**Done means:** the six cases pass; no golden moved; the game's lane can convert its cast with no new field (the
coordinator checks `every-field.toml` against the table above).

### Task K2: The wardrobe says what each thing takes

A form cannot be made from a garment that is only a function. Each registered garment, hair style, cap style, gait,
stand, seat, item and fabric gets a description beside it.

**Files:** `extensions/character-kit/src/features/fashion/describe.ts` and the registries it reads,
`extensions/figures/src/shared/outfit/` (the registry gains `describe`), `extensions/character-kit/tests/unit/fashion/describe.test.ts`, `src/entries/index.ts`.

**Interfaces, produced:**

```ts
export interface ParamSpec { readonly name: string; readonly kind: 'number' | 'choice' | 'swatch' | 'switch'; readonly min?: number; readonly max?: number; readonly choices?: readonly string[]; readonly default: unknown; readonly about: string }
export function describeGarment(name: string): readonly ParamSpec[]
export function wardrobe(): { readonly garments: readonly string[]; readonly hairStyles: readonly string[]; readonly capStyles: readonly string[]; readonly gaits: readonly string[]; readonly stands: readonly string[]; readonly seats: readonly string[]; readonly items: readonly string[]; readonly swatches: readonly string[] }
export function describeSliders(): readonly ParamSpec[] // the 18 build and 14 face sliders, with ranges
```

- [ ] **Step 1: the failing test.** Every name in `wardrobe().garments` has a description; for each garment, painting
  with each described parameter at its `min` and at its `max` gives two different cells (so no described parameter is
  dead), and every key that `every-field.toml` uses on a garment is described (so none is missing);
  `describeSliders()` has 32 entries; every `about` is a sentence a person can read (no code names). Expected: FAIL,
  `describeGarment` is not exported.
- [ ] **Step 2:** the descriptions, as data beside each garment. PASS; goldens unmoved.
- [ ] **Step 3:** build, api-report, api-index; gates; commit.

### Task K3: Characters opens and draws a character file (`claude/character-data-studio`, two sessions)

Waits for K2 and the editors v2 landing's tasks 2 to 4.

**Files:** `packages/editor-3d/src/features/studio/painted/` (new: `painted-stage.ts`, `character-document.ts`,
`CharacterCards.svelte`, `PaintedStage.svelte`), `packages/editor-3d/tests/unit/studio/painted/`,
`packages/editor-3d/tests/browser/studio-painted/`, `packages/editor-3d/README.md`.

- [ ] **Session 1, failing first (unit):** the document opens a `content/characters/*.toml` through K1's schema and
  writer; with no edit it saves the same bytes; an edit and its undo save the same bytes; a file that names an
  unregistered garment opens with a problem that names the field, and still saves unchanged. Then the home lists each
  character file as a card with its name.
- [ ] **Session 2, failing first (browser):** opening a card draws the painted figure at its own density; a turn
  control steps the 8 directions (the cell differs each step and returns after 8); Stand and Walk switch its state; a
  size control shows 1× and a whole-number enlargement, never a fraction; a time-of-day choice relights it; a
  1.75 m marker stands beside it.
- [ ] Gates after each session; `pnpm test:browser:3d`; commits.

### Task K4: Characters edits one, on a phone (two sessions)

**Files:** `packages/editor-3d/src/features/studio/painted/` (`CharacterInspector.svelte`, `OutfitList.svelte`,
`SwatchRamp.svelte`), their browser and layout tests.

- [ ] **Session 1, failing first (browser):** every group of the table has its form, made from K2's descriptions: a
  slider moves and the figure repaints; a choice lists the registry's names in words; an outfit's garments can be
  added, removed and reordered, each garment's parameters open under it; the outfit switcher changes what is drawn;
  each edit saves as the lines it changed and nothing else (`git diff --stat` on a copy: one file, the expected line
  count).
- [ ] **Session 2, failing first (layout, 390 × 844 and rotated):** the figure stays in view above the sheet; every
  control is at least 44 px and Save is 48 px; focus and the open group survive rotation and the on-screen keyboard;
  the sheet scrolls and the page does not; a change is seen in the running game after Save (the content the dev
  server serves has it). The words pass the drunk-grandma test: each group is named for what it changes ("Body",
  "Face", "Hair", "Clothes", "How they walk", "How they are drawn").
- [ ] Gates; `pnpm test:browser:3d`; commits.

**Done means (Part K):** the set's three people and `every-field.toml` open, draw, edit and save in Characters on a
phone; the game's lane has what it needs to make Ada and the nurse files.

---

## Part 2: the cast

### Task C2: Two things to hold and a pose (`claude/example-set-holds`)

Starts now: library data and one content file, needing nothing from the game's branches.

**Files:** `extensions/figures/src/shared/outfit/library/items.json` (`suitcase`, `handLamp`, in the shape of
`torch`), `extensions/figures/tests/unit/outfit/items.test.ts`; after F1 has merged,
`examples/set-3d/content/figure-poses/pull-lever.toml` and `examples/set-3d/tests/unit/cast/pose.test.ts`.

- [ ] **Step 1: the failing test.** The item library parses with its schema and lists `torch`, `suitcase` and
  `handLamp`; a base figure holding `suitcase` has painted texels below its hand that the same figure with no item
  lacks, on the hand's side, in all 8 directions; `handLamp` the same, and its lamp part names a warm bulb swatch; an
  unknown item is refused by name. Run `pnpm --filter @automata/figures test -- items`. Expected: FAIL, no item
  called `suitcase`.
- [ ] **Step 2:** the two items as library data. PASS; the painter's five goldens unmoved.
- [ ] **Step 3 (after F1):** failing test: `pull-lever.toml` parses as a `figure-poses` file and, applied to the base
  figure, puts the right hand forward of the chest and below the shoulder. Then the file. PASS.
- [ ] **Step 4:** gates; commit.

### Task C3: The traveller (`claude/example-set-cast`, Opus)

**Files:** `examples/set-3d/content/characters/traveller.toml`, `examples/set-3d/tests/unit/cast/cast.test.ts`,
`examples/set-3d/scripts/cast-sheet.ts` (front, three-quarter and back at density 2, at 1× and ×8, to `out/cast/`).

- [ ] **Step 1: the failing test.** `charactersOf(content)` has `traveller`; it parses with K1's schema; the game's `[figure] density` is 2; its outfit uses
  only registered garments; `readsAgainst(figure, room, camera)` passes against the platform and the waiting room by
  day. Expected: FAIL, no such character.
- [ ] **Step 2:** author the file from the place section's row (sliders, skin, hair, the coat's cloth and colour).
- [ ] **Step 3: look,** the sheet. **Step 4:** gates; commit.

**What to look at (C3 and C4):** at ×8, is the face a face (two eyes, a mouth, no grid); does the coat read as a coat
from the back; are hands and feet whole texels; do the three people differ in silhouette alone (fill each black and
compare); is the skin warm, not grey; does anyone look like anyone in The Last Light (they must not).

### Task C4: The stationmaster and the porter (Opus)

**Files:** `content/characters/stationmaster.toml`, `porter.toml`, `content/figure-poses/pull-lever.toml`,
`cast.test.ts` (extended).

- [ ] **Step 1: failing test:** both characters exist and parse; the stationmaster's cap style is `peakedCap` and the
  porter's `flat`; `pull-lever` parses as a `figure-poses` file; `SCENE_CAST` is the three ids. Expected: FAIL.
- [ ] **Step 2:** author. **Step 3: look,** the sheet of all three side by side on one ground line.
  **Step 4:** gates; commit.

### Task C5: The cast in the place (Opus)

Waits for L4 merged.

**Files:** the level's `cast` block; `content/look.toml` `[figure]`; `cast.test.ts`.

- [ ] **Step 1: failing test:** the level places the stationmaster in `ticketOffice` behind the `ticketWindow` and the
  porter on the platform's bench with seat `slump`; each `who` is a character file; in the browser project each of the
  three, standing in each zone by day and by night, passes `readsAgainst`. Expected: FAIL, no cast.
- [ ] **Step 2:** place them; set `dimmest`, `holdSkinHue` and `grid` in `look.toml` `[figure]` (no character file needs its own `[paint]`).
- [ ] **Step 3: look,** each person in each zone, day and night, portrait and landscape. **Step 4:** gates; commit.

**What to look at:** does each person stand on the floor, not in it; behind the counter, is the stationmaster cut at
the counter, texel by texel; seated, do the porter's hips meet the bench; at night, is a face still a face; under a
lamp, is anyone hotter than the floor round their feet.

---

## Part 3: the examples

### The example recipe (every E task applies it)

1. **The failing journey first:** `examples/3d/tests/e2e/scene-<name>.test.ts`, in the projects E1 adds. It opens
   `/scene/<name>/`, waits on the game's ready signal (never a sleep), does the journey in the table with real taps on
   real controls, and asserts the moment through `SceneProbe` and one measure of the canvas. It asserts the primary
   button's box is at least 48 px and inside the viewport, portrait and landscape. Run
   `pnpm --filter @af-examples/examples-3d test:e2e -- scene-<name>`. Expected: FAIL, the page is a 404.
2. **The content** the example needs, in the folders the table names, with its unit test in
   `examples/set-3d/tests/unit/<name>/` written first (the file parses; the kit's own check passes, e.g. the puzzle's
   solver finds no dead end).
3. **The file** `examples/3d/scene/scene-<name>.ts`: the header (`Shows` is the page's words below, word for word;
   `Controls` says what to press), then at most 40 code lines: `startGame(scene({ start, cast, extensions, on }))`.
4. **Delete** the old files the table names, and their journey files, in the same commit: `git rm` by path. Do not
   open them.
5. `pnpm examples:readme` (E1 adds it) rewrites the two README tables from the catalog.
6. Gates; the journey passes in Chromium portrait and landscape; WebKit where the session has it, else pending.
7. Commit `feat(examples): scene-<name> replaces <the old ids>`.

**The phone layout, for every example** (E1 builds it in `examples/set-3d/src/app/scene-controls.ts`): portrait, the
field at a whole scale at the top, the words of what to do in one line under it, a stick at bottom left and the one
primary button (48 px high, its verb written on it) at bottom right; landscape, the stick and the button over the
field's lower corners. A second action, where the table has one, is a 44 px button above the primary. Turning the
camera is a swipe on the field and two 44 px arrows.

### The list

| Task | Id | What it shows (capabilities, survey #) | Where; cast | The code it owns | The page's words | The journey to its moment | Retires (deleted in its commit) |
|---|---|---|---|---|---|---|---|
| E1 | `scene-camera` | A level from a file, the camera, the pixel-art look (1, 2, 3) | platform; traveller | `scene({ start: 'platform' })` and nothing else | "A whole station from one file. Walk along the platform. Swipe to look around." | walk 6 m, turn the camera a quarter; probe: zone `platform`, the view's yaw moved 90° | `world-level-room`, `render3d-angled-camera`, `render3d-meshes`, `look-pixel-art` |
| E2 | `scene-light` | Lamps, time of day, fog, the sky's stars and rain (4, 5) | platform; traveller | `addSkyPasses(…)`, a button that steps the time | "Press the button to turn day into dusk into night. The lamps come on. Then it rains." | press Time twice; probe time `night`; night's luminance below 0.8 of day's | `render3d-lighting-fog`, `worldkit-sky` |
| E3 | `scene-looks` | The LCD panel and the retro grade (8, 9) | waiting room; traveller | the two passes, a button that cycles Plain, Screen, Old film | "Press Look to see the same room through an old screen, then as old film." | press Look twice; the pass names active change; the frame differs from plain | `lcdpanel-screen`, `retrocrisp-grade` |
| E4 | `scene-props` | Props as data, a room furnished from one word, photo surfaces (6, 7) | store room (lit for this example); traveller | `dressLevel(level, worldKitLibrary)` with the room's `dress`, a button Empty / Furnished | "This room is empty. Press Furnish and the kit fills it." | press Furnish; the level's prop count rises; press again, it falls back | `worldkit-furnished-room`, `worldkit-generated-map` (Q6) |
| E5 | `scene-people` | Painted people from files: walk, stand, sit, wave, look at you (10, 11, 12) | platform; all three | which action the button asks for | "Three people, each one a file. Walk up to the porter. Press Wave and he waves back." | walk to the porter, press Wave; probe: the porter's action `wave` played; he faces the traveller | `figures-walk`, `figures-poses`, `figures-clips`, `figures-aim`, `figures-stand-and-sliders`, `characterkit-painted` |
| E6 | `scene-wardrobe` | Outfits, headwear, hair, the thing in a hand (12) | ticket office; traveller, stationmaster | a second outfit in each file is content; the code switches `outfit` | "Press Change. The coat comes off, the cap goes on, the case changes hands." | press Change three times; probe: the outfit name cycles and returns | `figures-outfits-items`, `characterkit-wardrobe`, `characterkit-hair`, the package `examples/3d/wardrobe` (Q6) |
| E7 | `scene-use` | Tap a thing, walk to it, use it; the play screen says what can be used (14, 15, 16, 20) | waiting room; traveller | `interactExtension`, `navExtension`, the HUD from `hud/play.toml`; the hotspots are the level's | "Tap the clock. She walks over and reads it. Tap the newspaper and she picks it up." | tap the clock's hotspot; probe: fact `clockRead`; tap the paper; carried has `newspaper` | none (new) |
| E8 | `scene-cutscene` | A scripted scene: camera, lamp, door, a reach on cue (19) | platform; traveller, porter | `cutscenesExtension`, play `arrival` once | "Press Play. The train's light comes down the line, the porter lifts his lamp." | press Play; the director reaches its last key; with reduced motion the camera does not drift and it still ends | `cutscenes-door-and-lamp`, `cutscenes-reach-cue` |
| E9 | `scene-talk` | A conversation with choices, and a short scene that waits for the right state (18) | ticket office; traveller, stationmaster | `narrativeExtension`; the words are `lines/` and one storylet | "Walk to the window and press Talk. Pick an answer. Ask again and he remembers." | Talk, choose the second answer, Talk again; probe: fact `askedForTicket`, the second visit's line differs | none (new) |
| E10 | `scene-puzzle` | Levers and lamps as a puzzle with facts; proved to have no dead end (16) | signal box; traveller | `puzzleExtension`; the levers are `puzzles/signals.toml` | "Three levers, three lamps. Pull them until all three lamps are green." | pull levers 2, 0, 1; probe: fact `lineClear`; the `leverFrame`'s `pulled` matches | none (new) |
| E11 | `scene-watch` | Rules for a creature: patrol, sight through a doorway, finding the way (13, 14, 17) | platform and waiting room; traveller, porter | `systemsExtension`, `navExtension`; the porter's rounds are `systems/porter.toml` | "The porter walks his round. Step into his lamp light and he comes over. Step behind the door and he loses you." | stand in his cone; probe: mode `approach`; walk behind the door; mode `patrol` | none (new) |
| E12 | `scene-dark` | A locked door, a key, a dark room, a carried light, and it is saved (4, 16, 23) | ticket office, store room; traveller | the carried lamp's light, `Host: grant=saves` | "The store room is locked and dark. Take the key from the cabinet, and the lamp. Come back later and you still have them." | take key, open door, light lamp (the room's luminance rises); reload; carried still has `key`; with `Host: grant=` it says "Saving is off here" | none (new) |
| E13 | `scene-sound` | Sound from numbers, and feel (21, 22) | platform; traveller | `audioSynthExtension`, `feelExtension`; `audio/station.toml`, `feel/station.toml` | "Walk from stone to wood and hear your steps change. Press Bell. When the train passes, the ground shakes." | walk onto boards; the step cue's id changes; press Bell; the feel entry `trainPass` fires | none (new) |

Content each task adds under `examples/set-3d/content`: E7 `nav/station.toml` and the level's `entityDefs`
(owned by E7; E11 and E14 read it); E8 `cutscenes/arrival.toml`; E9 `lines/station.toml`, `storylets/ticket.toml`;
E10 `puzzles/signals.toml`; E11 `systems/porter.toml`; E7 also `hud/play.toml` (E12 and E14 read it); E12 `puzzles/store-room.toml`;
E13 `audio/station.toml`, `feel/station.toml`. E7 lands before E11 and E12 on any branch that needs `nav`.

### Task E1: `scene-camera`, and the journeys' harness (`claude/example-set-examples-a`)

Beyond the recipe:

**Files:** `examples/3d/playwright.config.ts` (four projects for `scene-*.test.ts`: `Pixel 7`, `Pixel 7 landscape`,
`iPhone 14`, `iPhone 14 landscape`; the two existing projects keep the old journeys until E15 removes them),
`examples/3d/tests/e2e/scene.ts` (`openScene(page, name)`, `probe(page)`, `press(page, label)`, `luminance(page)`,
`expectPrimaryButton(page)`), `examples/set-3d/src/app/scene-controls.ts`, `tooling/examples-runner/src/readme.ts` and
the root script `examples:readme`, with `tooling/examples-runner/tests/unit/readme.test.ts` (failing first: the table
it writes for a fixture folder is one row per valid example, sorted by id).

**Done means:** `scene-camera`'s journey passes in the two Chromium projects; the four old files and their four
journeys are gone; `pnpm examples:readme --check` exits 0.

### Tasks E2 to E13

Each is the recipe with its row. No further files beyond the row's and the content named above.

### Task E14: The story: the place played end to end (`claude/example-set-story`, two sessions)

**Files:** `examples/3d-story/` rebuilt: `package.json` keeps its name and scripts, depends on `@af-examples/set-3d`
and the kits; `src/main.ts`, `src/app/game.ts` (`scene({ start: 'platform', time: 'dusk', cast: SCENE_CAST,
extensions: [every kit the examples use] })`), `src/features/story/` (the six beats as `storylets` and `puzzles`
content in `examples/set-3d/content/beats/station.toml`, and at most one `.system.ts` that ends the game),
`tests/unit/story/`, `tests/e2e/story.test.ts`. The old `content/`, `src/features/guard`, `room`, `wick` and
`tests` are deleted in the same commit, and `tooling/examples-runner/tests/unit/ports.test.ts` points at the new
`tests/e2e/origins.ts`.

- [ ] **Step 1: failing unit test:** the narrative tools' dead-end check and the puzzle solver, run over the story's
  content, find a path from the first beat to the last and no state with no way on. Expected: FAIL, no beats.
- [ ] **Step 2: failing journey:** a bot's input script (fixed seed) plays the six beats on a portrait phone and
  reaches the end screen; the golden hash of the sim after the script is the same in Node and Chromium. Expected:
  FAIL.
- [ ] **Step 3:** the beats, the wiring, the end screen (the default screens). Both pass.
- [ ] **Step 4:** gates; commit `feat(examples): the station played end to end replaces the old 3D story`.

**Done means:** both pass; `pnpm --filter @af-examples/3d-story check` exit 0; the Schematic journey that played the old
story is moved to S5's journeys (its file is deleted here and named in the log).

### Task E15: The sweep: nothing names an old example

- [ ] **Step 1: the failing test,** `tooling/repo-hygiene/tests/unit/old-examples.test.ts`: `git grep` over tracked
  files outside `docs/archive`, `docs/superpowers` and `docs/refactor` finds none of the 21 old ids
  (`figures-walk`, …, written in the test as a list), nor `examples/3d/wardrobe`, nor the old module names in
  `catalog.ts`'s lists. Expected: FAIL with the files the survey's section 3 lists.
- [ ] **Step 2:** remove each mention: `catalog.ts` (the modules `render3d`, `figures`, `look`, `world`, `cutscenes`,
  `characterkit`, `worldkit`, `lcdpanel`, `retrocrisp`), `pnpm-workspace.yaml`, `knip.jsonc`, root `package.json`
  (`style`, `source-names`), the kits' READMEs (point at the new id), `packages/3d`'s six files, `games/base-3d`'s
  one, `docs/guides/3d.md`, `docs/status.md`, `docs/provenance`; the two old Playwright projects in
  `examples/3d/playwright.config.ts`; `examples/3d/tests/e2e/colours.ts` if nothing imports it.
- [ ] **Step 3:** `.github/workflows/3d.yml` is not edited: confirm its three names still exist
  (`examples/3d/**`, `@af-examples/examples-3d`, `@af-examples/3d-story`). Gates; commit.

---

## Part 4: the set as a stress test

### Task S1: Every file has a row and round-trips in Node (`claude/example-set-editors`)

**Files:** `examples/set-3d/content/editors.toml`, `examples/set-3d/tests/unit/editors/round-trip.test.ts`.

- [ ] **Step 1: the failing test.** For every file under `content/`: it matches exactly one `[[file]]` row of
  `editors.toml`, or it is one of exactly three named "no editor yet" files (`look.toml`, `hud/play.toml`,
  `storylets/ticket.toml`; `beats/station.toml` joins them only if Writer cannot open it, and the test's list is the
  record); and reading it with its editor's codec (the level's `af-codec`, the TOML session, K1's `writeCharacter`) and writing it back with no edit gives the same bytes. Expected: FAIL, files with no row.
- [ ] **Step 2:** the rows: levels to `levels-3d`; `characters/` and `figure-*/` to `studio`; `lines/` to `writer`;
  `cutscenes/` to `sequence`; `systems/`, `nav/`, `puzzles/` to `schematic`; `audio/` to `audio`; `feel/` to `feel`;
  `tuning.toml` to `tuner`. Where a file does not round-trip because of how it was typed (a number's form, key
  order), retype the file the way the editor writes it; where the codec loses something, stop and record it as a gap.
- [ ] **Step 3:** gates; commit. This test runs in `pnpm check` from then on, so a new content file without a row fails.

### Task S2: A whole number stays a whole number

Stress row 11. **Files:** the TOML session's number writer in `packages/editor/src/shared/kit/documents/` (find it:
`git grep -n "toFixed\|\\.0'" packages/editor/src/shared/kit/documents`), its unit test beside the existing
`tests/unit/shared/kit/documents/`.

- [ ] **Step 1: failing test:** a document holding `t = 11` whose field is set to 10.5 and back to 11 writes `t = 11`;
  one holding `t = 11.0` writes `t = 11.0`; a new whole number in a field the schema types as a float writes with the
  form its neighbours in the same table use. Expected: FAIL, `11.0`.
- [ ] **Step 2:** keep the written form per value. PASS. **Step 3:** gates; commit.

### Task S3: A tap on a prop selects the prop

Stress row 2. **Files:** `packages/editor-3d/src/features/levels-3d/plan/` (the plan's hit test), a unit test in
`packages/editor-3d/tests/unit/levels-3d/plan/` and a browser test in `packages/editor-3d/tests/browser/`, both on the
set's level (read from `examples/set-3d/content/levels/station.af-sector.json` as a fixture path).

- [ ] **Step 1: failing tests:** a tap at a prop's centre inside a room selects that prop, not the room; a tap on a
  lamp or a hotspot selects it; a tap on bare floor selects the room; with Rooms locked in Layers a drag on a prop
  moves the prop and no corner; a tap on a layer's row selects that layer's first thing. Expected: FAIL, the room is
  selected.
- [ ] **Step 2:** hit-test smallest thing first (hotspot, lamp, prop, then room). PASS.
- [ ] **Step 3:** gates, `pnpm test:browser:3d`; commit.

(There is no task S4: Characters opening a character file is Part K, tasks K3 and K4.)

### Task S5: A journey for each editor (two sessions)

Waits for v2's task 6, E14, S1 to S3 and K4.

**Files:** `examples/3d-story/tests/e2e/editors/<editor>.test.ts`, one each for `levels-3d`, `studio`, `writer`,
`sequence`, `schematic`, `audio`, `feel`, `tuner` (eight; the set has no 2D level), and
`examples/3d-story/tests/e2e/editors/harness.ts` (serves `automata editor` over a copy of `examples/set-3d`).

- [ ] Each journey, failing first: opens the one page on a portrait phone, opens the set's file from its card, makes
  one small named change (move the bench 1 m; lengthen the coat; change a line's words; retime a cutscene key; widen
  the porter's sight; change the bell's pitch; halve the shake; raise walking speed), saves, checks `git diff` on the
  copy is that one line, checks the running game's served content has the change, undoes it, and checks the diff is
  empty.
- [ ] Gates; `pnpm test:journeys:3d`; commit. Report which engines ran.

**Editor gaps: which must close first, and who closes them**

| Stress row | Gap | Must close before | Closed by |
|---|---|---|---|
| 1 | One page for every editor | S5 | editors v2 landing, task 6 |
| 2 | Prop tap selects the room | S5 (`levels-3d` journey) | S3 here (Q4) |
| 3 | Characters cannot open a painted character | S1's character rows, S5 | Part K here (K1 to K4), shared with the game |
| 11 | `X.0` | S1's round-trip of files a person retyped, S5's empty diff | S2 here |
| 4 | Recorded sound reads silent | never met | the set uses synth voices only |
| 5 to 10, 13, 14 | Problems list, models in 3D, view fields, `with`, Sequence's picture and ease label, Schematic and phone layout | not blocking: the set's journeys do not use them | the editors lane; S5 reports what it met |
| 12, 15, 16, 17 | No editor for storylets, look, HUD; unrouted files not listed | not blocking (Q5): three files, named in S1's test | the editors lane |

---

## Part 5: 2D (not started; waits on the Owner's yes)

The same rule with Emberwick's world and people as the one set, as the spec recommends: one content package
(`examples/set-2d`) made from Emberwick's room and characters, each 2D example that room with one thing on, the 27
single-file examples and `2d-story` replaced as each replacement lands, pages through the playground that already
serves 2D. Rough size, not a plan: the shape (1 session), the place and cast as content from Emberwick (2, look work on
Opus), about 14 examples from the 27 by merging the input, render and UI groups (7), the story (2), editors' journeys
for Levels 2D and the shared editors (2), the sweep (1): **about 15 sessions**. It needs its own survey of what
`examples/2d` covers and its own plan. Nothing here starts it.

## The Owner's part

### Task O1: The sheets for the Owner (`claude/example-set-sheets`, Opus)

After L4 and C5. **Files:** `docs/superpowers/audits/2026-11-13-example-set-sheets/` (PNG sheets and a `README.md`
that says what each is and how it was made, with the command).

- [ ] The place: one sheet by day and one by night, each zone from its view, portrait and landscape.
- [ ] The cast: each person front, three-quarter and back at density 2, at 1× and ×8; the three together; each in the
  place.
- [ ] One frame per example at its moment (drawn from the content, before the examples exist: the zone, the cast and
  the thing the table names).
- [ ] The session opens every sheet and every frame and writes what it saw; the coordinator opens them again before
  the Owner does (rule 6).

What is asked of the Owner, in order:

1. Is a small country railway station the place? If not, which place (it needs an outdoors, a furnished room, a person
   behind a counter, a machine with switches, a locked dark room).
2. The place, day and night: yes or what to change.
3. The cast, enlarged and in the place: yes or what to change.
4. One frame per example: yes, or which to drop or merge.
5. His yes before any picture is recorded (journey goldens, `screenshots-approved.json`, the site's stills).
6. Yes or no on Part 5: the 2D set from Emberwick.

## Self-check (done at writing)

- Every path is either on `main` today, on a branch this plan waits for and checks for by command, or created by an
  earlier task: F1 creates `examples/set-3d` and `catalog.ts`'s rule before any task writes there; K1 creates the
  character kind before C3, C4, K3 and S1; K2 before K3; F2 before L4; E1's harness before E2 to E13; E7's `nav` file
  before E11 and E12; F3's mechanism before F4.
- No two parallel branches own one file (the table under "In parallel, by folder"). The level file is written by the
  place branch, then C5, then E7, in that order, never at once. `items.json` is C2's alone; the other registries are
  K2's.
- Totals: 4 + 7 + 4 + 4 + 15 + 4 + 1 = 39 tasks; sessions 4 + 7 + 6 + 4 + 10.5 + 4.5 + 1 = 37 (Opus: L1 to L4 are 5,
  C3 to C5 are 3, O1 is 1; Sonnet 28).
- No task opens, judges or ports an old example: deletion is `git rm` by the paths in the list. Part K reads the
  game's cast file for its field names only and copies no value.

## For the tracker

Text for `docs/superpowers/progress.md`, not applied by this session:

> **Workstream: one example set (3D).** Spec `specs/2026-11-13-one-example-set-design.md`; survey
> `audits/2026-11-13-example-set-survey.md`; plan `plans/2026-11-13-one-example-set.md`. Stage 2 (plan) done
> 2026-11-13 on `claude/example-set-plan`; stage 3 (plan audit, Opus) is next. 39 tasks, 0 done (0%), about 37 build
> sessions (9 Opus). Thirteen examples and a story replace 21 examples, the wardrobe package and the old 3D story.
> Can start now, from `main`: F1 (the shape), F3 (the site's mechanism, on fixtures), W1 to W3 (seven prop generators,
> a lamp preset, two CC0 photos), C2 (the items `suitcase` and `handLamp`, the pose `pullLever`). Waits on: the joined
> prologue branch and the night fix on `main` (the field, Part K, the place, the cast); ship-3d B10 and the Owner's
> yes on the sheets (every example); editors v2 tasks 2 to 4 and 6 (Characters, the editor fixes, the journeys).
> Asked of the 3D ship plan: `@automata/interact` and `@automata/hud` join its Part B publish list.
>
> **Workstream: a character is data (Part K of the same plan; shared with The Last Light).** Four tasks, 6 sessions:
> K1 the `character` content kind in `@automata/character-kit`, K2 the wardrobe describes its parameters, K3 and K4
> Characters opens, draws and edits a character file on a phone. Closes editor gap 3. The game converts Ada and the
> nurse with K1's kind in its own plan.
>
> Open questions for the coordinator: Q1, Q3 to Q9 in the plan; the ones that change scope are Q3 (the whole-pixel
> field and the look file lifted from the game) and Q4 (who closes stress row 2). Part 5 (2D from Emberwick, about 15
> sessions) waits on the Owner's yes.

## Log

| Date | Session | Task | What happened | Commit |
|---|---|---|---|---|
