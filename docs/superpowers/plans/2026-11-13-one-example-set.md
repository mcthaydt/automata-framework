# One example set, a single place and a single cast: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task, one
> session per branch, with no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the 3D examples become one small world with three people in it, each example that world with one thing
switched on, every file of it content an editor opens; the old 3D examples are deleted as their replacements land.

**Architecture:** the place and the cast are one private workspace package of content, `examples/set-3d`
(`@af-examples/set-3d`), with a single entry, `scene(options)`, that returns a game definition. Each example is one file
in `examples/3d/scene/` that calls `scene` and adds its one thing from a published kit. The story game in
`examples/3d-story` is the same content with everything on. What the content kinds cannot say today (a painted character,
a whole-pixel field, a look read from a file) is added to the framework first, test first, for every game.

**Tech stack:** TypeScript, PixiJS 8 with `@pixi/3d`, Koota behind the sim facade, Zod, Vitest, Playwright, pnpm, turbo,
Biome. Markdown is not formatted by a tool.

**Spec:** [`../specs/2026-11-13-one-example-set-design.md`](../specs/2026-11-13-one-example-set-design.md).
**Survey (the measurements this plan argues from):**
[`../audits/2026-11-13-example-set-survey.md`](../audits/2026-11-13-example-set-survey.md).

## Tracking

| Task | Part | Branch | Sessions | Model | State | % |
|---|---|---|---|---|---|---|
| F1 The set's shape: the catalog, the package, the entry | 0 | `claude/example-set-shape` | 1 | Sonnet | not started | 0% |
| F2 A whole-pixel field and a look file, in the framework | 0 | `claude/example-set-kinds` | 1 | Sonnet | not started | 0% |
| F3 The site shows a 3D example | 0 | `claude/example-set-site` | 2 | Sonnet | not started | 0% |
| W1 Two photos and their swatches | 1 | `claude/example-set-props` | 0.5 | Sonnet | not started | 0% |
| W2 Track and platform props | 1 | `claude/example-set-props` | 1 | Sonnet | not started | 0% |
| W3 Indoor props and the platform lamp | 1 | `claude/example-set-props` | 0.5 | Sonnet | not started | 0% |
| L1 The level: rooms, walls, doors, the fit | 1 | `claude/example-set-place` | 1 | Opus | not started | 0% |
| L2 Dressed by day | 1 | `claude/example-set-place` | 2 | Opus | not started | 0% |
| L3 Night, lamps and sky | 1 | `claude/example-set-place` | 1 | Opus | not started | 0% |
| L4 The views, at the scale rule | 1 | `claude/example-set-place` | 1 | Opus | not started | 0% |
| C1 A character is a content file | 2 | `claude/example-set-kinds` | 1 | Sonnet | not started | 0% |
| C2 Two things to hold and a pose | 2 | `claude/example-set-kinds` | 1 | Sonnet | not started | 0% |
| C3 The traveller | 2 | `claude/example-set-cast` | 1 | Opus | not started | 0% |
| C4 The stationmaster and the porter | 2 | `claude/example-set-cast` | 1 | Opus | not started | 0% |
| C5 The cast in the place | 2 | `claude/example-set-cast` | 1 | Opus | not started | 0% |
| E1 `scene-camera`, and the journeys' harness | 3 | `claude/example-set-examples-a` | 1 | Sonnet | not started | 0% |
| E2 `scene-light` | 3 | `claude/example-set-examples-a` | 0.5 | Sonnet | not started | 0% |
| E3 `scene-looks` | 3 | `claude/example-set-examples-a` | 0.5 | Sonnet | not started | 0% |
| E4 `scene-props` | 3 | `claude/example-set-examples-a` | 0.5 | Sonnet | not started | 0% |
| E5 `scene-people` | 3 | `claude/example-set-examples-b` | 1 | Sonnet | not started | 0% |
| E6 `scene-wardrobe` | 3 | `claude/example-set-examples-b` | 0.5 | Sonnet | not started | 0% |
| E7 `scene-use` | 3 | `claude/example-set-examples-b` | 0.5 | Sonnet | not started | 0% |
| E8 `scene-cutscene` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | not started | 0% |
| E9 `scene-talk` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | not started | 0% |
| E10 `scene-puzzle` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | not started | 0% |
| E11 `scene-watch` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | not started | 0% |
| E12 `scene-dark` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | not started | 0% |
| E13 `scene-sound` | 3 | `claude/example-set-examples-c` | 0.5 | Sonnet | not started | 0% |
| E14 The story: the place played end to end | 3 | `claude/example-set-story` | 2 | Sonnet | not started | 0% |
| E15 The sweep: nothing names an old example | 3 | `claude/example-set-story` | 1 | Sonnet | not started | 0% |
| S1 Every file has a row and round-trips in Node | 4 | `claude/example-set-editors` | 1 | Sonnet | not started | 0% |
| S2 A whole number stays a whole number | 4 | `claude/example-set-editors` | 0.5 | Sonnet | not started | 0% |
| S3 A tap on a prop selects the prop | 4 | `claude/example-set-editors` | 1 | Sonnet | not started | 0% |
| S4 Characters opens a character file | 4 | `claude/example-set-editors` | 3 | Sonnet | not started | 0% |
| S5 A journey for each editor | 4 | `claude/example-set-editors` | 2 | Sonnet | not started | 0% |
| O1 The sheets for the Owner | Owner | `claude/example-set-sheets` | 1 | Opus | not started | 0% |

Progress: 0 of 36 tasks (0%). Per part: 0 of 3 (Part 0), 0 of 7 (Part 1), 0 of 5 (Part 2), 0 of 15 (Part 3), 0 of 5
(Part 4), 0 of 1 (the Owner's sheets). Part 5 (2D) has no tasks until the Owner says yes. Sessions: 35 (26 Sonnet at
high effort, 9 Opus at medium), before audits and fixes.

## Order and dependencies

```
now, on main ──► F1 (shape) ─┐
now, on main ──► W1 W2 W3 ───┤
camera + ada + night fix on main ──► F2, C1, C2 (kinds) ─┬─► L1 L2 L3 L4 (place) ─┐
                                                          └─► C3 C4 (cast) ────────┴─► C5 ─► O1 (sheets) ─► the Owner's yes
editors v2 tasks 2-4 on main ──► S2 S3 ; C1 + v2 ──► S4
the Owner's yes + ship-3d B10 (kits public) ──► E1 ─► E2…E13 (three branches) ─► E14 ─► E15
ship-3d B10 + pixi-3d-public + E1 ──► F3 (site)
v2 task 6 (one page) + E14 + S1…S4 ──► S5
```

**What starts now, before any other lane lands** (both branch from `main` today):

- **F1** touches `tooling/examples-runner` and a new folder; the game's branches change 6 files under `tooling` and
  `examples` between them, none of them the catalog.
- **W1 to W3** add new files to `extensions/world-kit` and one line each to `register-props.ts`, `props.json`,
  `swatches.json` and `photos.json`. The game's branches change 9 world-kit files; a conflict there is a few lines.

**What waits, and why:**

- **F2, C1, C2 and every Opus task wait for `claude/last-light-camera`, `claude/last-light-ada` and
  `claude/3d-night-regression` to be on `main`.** The decision, with its reason: the place and the cast are **not** built
  on a branch stacked on the game's branches. Camera and ada have diverged (9 and 22 commits the other lacks; 59 and 61
  changed files in `character-kit`, 58 and 42 in `packages/3d`); a third branch on top would have to merge both itself
  and be rebuilt when they land, and every look frame taken before that would be taken again. The place needs `lensMm`
  and `focusBounds` (camera), the cast needs density 2, `grid`, `dimmest` and `holdSkinHue` (ada), and night frames need
  the night fix. The props and the shape do not, so they go first.
- **Every example (E1 on) waits for ship-3d B10**, so that it imports the kits as built packages, and for **the Owner's
  yes** on the sheets (O1), so that no journey or picture is made of a place he has not seen.
- **F3 waits** for B10 and `claude/pixi-3d-public` (the site may not show 3D before both).
- **S2, S3, S4 wait** for the editors v2 landing's tasks 2 to 4 (v2 rewrites the editors' pages; a fix made before it
  is made twice). **S5 waits** for v2's task 6, the one page that holds every editor.
- **The scope rename** may land at any point. Every task writes a package name only as a whole literal
  (`@automata/<name>`), never joined from pieces, so the codemod rewrites it. `@af-examples/*` is not renamed.

**In parallel, by folder** (no two own one file):

| Branch | Owns |
|---|---|
| `claude/example-set-shape` | `tooling/examples-runner/src/catalog.ts` and its test; `examples/set-3d/` (skeleton: `package.json`, `src/`, `tests/unit/shape/`) |
| `claude/example-set-props` | `extensions/world-kit/` |
| `claude/example-set-kinds` | `extensions/character-kit/src`, `extensions/retro-crisp/src`, `packages/3d/src/features/look` |
| `claude/example-set-place` | `examples/set-3d/content/levels`, `content/world-*`, `content/look.toml`, `tests/unit/place/` |
| `claude/example-set-cast` | `examples/set-3d/content/characters`, `content/figure-*`, `tests/unit/cast/`; C5 alone adds the level's `cast` block, after `-place` has merged |
| `claude/example-set-examples-a`, `-b`, `-c` | each its own files in `examples/3d/scene/` and `examples/3d/tests/e2e/`, the old files it deletes, and its own content folders in `examples/set-3d/content` (named per task). `examples/README.md` and `examples/3d/README.md` are regenerated by one command (E1 adds it), never edited by hand, so three branches do not collide on them |
| `claude/example-set-editors` | `packages/editor`, `packages/editor-3d`, `extensions/editors`, `examples/set-3d/content/editors.toml`, `examples/3d-story/tests/e2e/editors/` |
| `claude/example-set-site` | `site/` |
| `claude/example-set-story` | `examples/3d-story/` but for `tests/e2e/editors/` |

**The critical path:** camera, ada and the night fix on `main` → C1 → C3, C4 → C5 → O1 → the Owner's yes → E1 → E14 →
S5. The longest wait that this plan does not control is ship-3d B10 (the kits public), which gates E1.

**The honest total:** 35 build sessions (9 of them Opus look sessions), plus the plan audit (1), implementation
audits (about 4, one per part) and fixes (about 4): **about 44 sessions**. With three example branches and the editors
branch in parallel the calendar is shorter than the count.

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

## Questions for the coordinator, with the answer this plan takes

| # | Question | Recommended answer (the plan assumes it) |
|---|---|---|
| Q1 | The spec says examples import the kits "as a stranger would". May an example also import the set's own workspace package, which a stranger cannot install? | Yes. The kits come by published name; the place is content, and the page says "the station is in `examples/set-3d`; copy the folder". The alternative, each example carrying the level inline, breaks "small enough to read in a minute". |
| Q2 | `@automata/interact` and `@automata/hud` stay private in the 3D lane's plan because nothing public imports them. `scene-use` and the story do. | Ask the 3D lane to add both to B10's list (two more kit recipes). Until then E7 and E14 are built and the site leaves `scene-use` out, as `playgroundCatalog` already does for a private import. |
| Q3 | `fieldFor`, `wholeScaleFor`, the passes wired from `look.toml` and the figure options (`grid`, `dimmest`, `holdSkinHue`, density) are code in `games/the-last-light/src/app`. The set may borrow nothing from the game. | F2 and C1 put them in the framework for everyone (`@automata/retro-crisp` for the field, a `look` reader in `@automata/3d`, the options in the character file). If the game's lane is already lifting them, F2 becomes "use what landed" and loses its session. |
| Q4 | Who closes stress rows 2 (prop tap) and 3 (Characters opens a painted character)? No plan in flight owns them. | This plan, as S3 and S4, on the editors branch after v2. If the editors lane takes them, S3 and S4 leave this plan and S5 waits on that lane. |
| Q5 | Rule 5 says every file opens in its editor. `look.toml`, the HUD file and storylets have no editor (stress rows 12, 15, 16). | The set lists them as "no editor yet" (S1's test names exactly three files) and the home page shows them as text. A schema form for small files is the editors lane's, not this plan's. |
| Q6 | `examples/3d/wardrobe` shows how to write a garment extension, and `worldkit-generated-map` shows `generateMap`. Neither fits one place and one cast. | Both are deleted with E6 and E4 and not replaced: the kits' READMEs keep "Add your own" and "Make a whole place". Rule 1 forbids keeping an old example because nothing replaced it. |
| Q7 | The examples' ids carry no place name (`scene-camera`), so a different place does not rename thirteen pages. | Keep it. If the Owner wants the place in the name, it is one rename in F1 before any page exists. |
| Q8 | The old journeys run on landscape phones only. Rule 4 says phone first. | The new journeys run portrait (`Pixel 7`, `iPhone 14`) and landscape; portrait is the design size. |

## Global constraints

- The Owner, 2026-11-13: "the 3D examples should be a unique set, a single environment, a single set of characters";
  "no need to grade work we're throwing away". **No task reviews, shoots, grades, describes or ports an old example.**
  A task that deletes one reads only its file name.
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
- A hash that moves is investigated. W1 to W3, F2, C1 and C2 add to kits: they move no existing golden, tile or hash.

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
   word, never draws a bare figure (C1's test).
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

Waits for camera and ada on `main`. If their lane has already lifted these (Q3), tick this task with the commit that did.

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

### Task F3: The site shows a 3D example

Waits for ship-3d B10, `claude/pixi-3d-public` and E1.

**Files:**
- Modify: `site/src/shared/framework/examples.ts` (a second reader, `sceneExamples(root)`, over `examples/3d`), `site/src/shared/framework/example-catalog.ts` (a group "One small world, in 3D"), `site/scripts/build-demos.ts` (build `examples/3d` once into `static/scenes/`), `site/src/features/examples/ExamplePage.svelte` and `ExamplesIndex.svelte`, `site/src/features/home/HomeExamples.svelte`
- Create: `site/src/features/examples/SceneFrame.svelte`, `site/tests/unit/framework/scene-examples.test.ts`, `site/tests/e2e/scene-examples.e2e.ts`

- [ ] **Step 1: failing unit test.** `sceneExamples()` returns one entry per valid `scene` example whose imports are
  all published, each with `id`, `title`, `shows`, `controls`, `source` and `frameUrl = /scenes/<name>/index.html`; an
  example that imports a private package is absent. Run `pnpm --filter @automata/site test -- scene-examples`. Expected: FAIL,
  `sceneExamples` is not exported.
- [ ] **Step 2:** the reader, the build step, the frame component (a framed page with the site's frame headers, a
  Play button of 48 px over a still, so no 3D loads until asked), the page.
- [ ] **Step 3: failing e2e, then green.** At 390 × 844 and 1280 × 800: `/examples/scene-camera` shows the words, the
  code, and after one tap on Play a canvas that has drawn (the frame's ready message); no horizontal scroll; the Play
  button's box is at least 48 px. `pnpm build && pnpm check:site` pass.
- [ ] **Step 4:** gates; commit.

**Done means:** every published `scene` example and the story have a page; `check:site` passes; the page count that
changed is recorded in the log (expected: the index, the home, and one new page per example).

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

Waits for camera on `main` and F2.

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

## Part 2: the cast

### Task C1: A character is a content file (`claude/example-set-kinds`)

Waits for ada on `main`. This closes the kit's half of stress row 3 for every game.

**Files:**
- Create: `extensions/character-kit/src/features/painted/character.schema.ts`, `character.content.ts`, `extensions/character-kit/tests/unit/content/character.test.ts`, `extensions/character-kit/tests/fixtures/characters/plain.toml`
- Modify: `extensions/character-kit/src/app/character-kit.extension.ts` (the kind, folder `characters`), `src/entries/index.ts`, `README.md`

**Interfaces, produced:**

```ts
export const characterFileSchema: z.ZodType<CharacterFile> // the painter's CharacterDef, every field, plus density?: 1 | 2
export function charactersOf(content: Content): ReadonlyMap<string, CharacterFile>
export function paintedFromFile(file: CharacterFile, options?: PaintedOptions): FigureView // paintedFigure with the file's density
```

- [ ] **Step 1: the failing test.** `plain.toml` (sliders, skin, gait, one outfit of `tee` and `trousers`) parses and
  `paintedFromFile` paints the same cell, texel for texel, as `paintedFigure` given the same definition in TypeScript;
  a file naming the garment `cloak` is refused with `content/characters/plain.toml: outfits.default[1]: No garment
  called "cloak" is registered`; the same for an unknown swatch, gait, hair style and cap style; writing the parsed
  file back gives the same bytes (key order and number form kept). Run
  `pnpm --filter @automata/character-kit test:unit -- character`. Expected: FAIL, the module does not exist.
- [ ] **Step 2:** the schema (written types on every export), the kind, the reader. PASS, and the kit's goldens unmoved.
- [ ] **Step 3:** the README's section "A character as a file"; build, api-report, api-index; changeset; gates; commit.

### Task C2: Two things to hold and a pose

**Files:** the painter's item library and its schema (`extensions/figures/src/shared/outfit/library/items.json`:
`suitcase`, `handLamp`), `extensions/character-kit/src/features/painted/character.schema.ts` (a character's `item`),
`extensions/character-kit/tests/unit/painted/items.test.ts`; `examples/set-3d/content/figure-poses/pull-lever.toml`
is the place's own and is made in C4, not here.

- [ ] **Step 1: the failing test.** A character holding `suitcase` has painted texels below its hand that the same
  character with no item lacks, on the hand's side, in all 8 directions; `handLamp` the same, and with
  `lit: true` its lamp swatch is the kit's `bulbWarm`; an unknown item is refused by name. Expected: FAIL, no item
  called `suitcase`.
- [ ] **Step 2:** the two items as library data in the shape of `torch`. PASS; the five goldens unmoved.
- [ ] **Step 3:** gates; commit.

### Task C3: The traveller (`claude/example-set-cast`, Opus)

**Files:** `examples/set-3d/content/characters/traveller.toml`, `examples/set-3d/tests/unit/cast/cast.test.ts`,
`examples/set-3d/scripts/cast-sheet.ts` (front, three-quarter and back at density 2, at 1× and ×8, to `out/cast/`).

- [ ] **Step 1: the failing test.** `charactersOf(content)` has `traveller`; it parses; `density` is 2; its outfit uses
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
- [ ] **Step 2:** place them; set `dimmest`, `holdSkinHue` and `grid` in `look.toml`.
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
| E7 | `scene-use` | Tap a thing, walk to it, use it; prompts (14, 15, 16, 20) | waiting room; traveller | `interactExtension`, `navExtension`, the hotspots are the level's | "Tap the clock. She walks over and reads it. Tap the newspaper and she picks it up." | tap the clock's hotspot; probe: fact `clockRead`; tap the paper; carried has `newspaper` | none (new) |
| E8 | `scene-cutscene` | A scripted scene: camera, lamp, door, a reach on cue (19) | platform; traveller, porter | `cutscenesExtension`, play `arrival` once | "Press Play. The train's light comes down the line, the porter lifts his lamp." | press Play; the director reaches its last key; with reduced motion the camera does not drift and it still ends | `cutscenes-door-and-lamp`, `cutscenes-reach-cue` |
| E9 | `scene-talk` | A conversation with choices, and a short scene that waits for the right state (18) | ticket office; traveller, stationmaster | `narrativeExtension`; the words are `lines/` and one storylet | "Walk to the window and press Talk. Pick an answer. Ask again and he remembers." | Talk, choose the second answer, Talk again; probe: fact `askedForTicket`, the second visit's line differs | none (new) |
| E10 | `scene-puzzle` | Levers and lamps as a puzzle with facts; proved to have no dead end (16) | signal box; traveller | `puzzleExtension`; the levers are `puzzles/signals.toml` | "Three levers, three lamps. Pull them until all three lamps are green." | pull levers 2, 0, 1; probe: fact `lineClear`; the `leverFrame`'s `pulled` matches | none (new) |
| E11 | `scene-watch` | Rules for a creature: patrol, sight through a doorway, finding the way (13, 14, 17) | platform and waiting room; traveller, porter | `systemsExtension`, `navExtension`; the porter's rounds are `systems/porter.toml` | "The porter walks his round. Step into his lamp light and he comes over. Step behind the door and he loses you." | stand in his cone; probe: mode `approach`; walk behind the door; mode `patrol` | none (new) |
| E12 | `scene-dark` | A locked door, a key, a dark room, a carried light, and it is saved (4, 16, 23) | ticket office, store room; traveller | the carried lamp's light, `Host: grant=saves` | "The store room is locked and dark. Take the key from the cabinet, and the lamp. Come back later and you still have them." | take key, open door, light lamp (the room's luminance rises); reload; carried still has `key`; with `Host: grant=` it says "Saving is off here" | none (new) |
| E13 | `scene-sound` | Sound from numbers, and feel (21, 22) | platform; traveller | `audioSynthExtension`, `feelExtension`; `audio/station.toml`, `feel/station.toml` | "Walk from stone to wood and hear your steps change. Press Bell. When the train passes, the ground shakes." | walk onto boards; the step cue's id changes; press Bell; the feel entry `trainPass` fires | none (new) |

Content each task adds under `examples/set-3d/content`: E7 `nav/station.toml` and the level's `entityDefs`
(owned by E7; E11 and E14 read it); E8 `cutscenes/arrival.toml`; E9 `lines/station.toml`, `storylets/ticket.toml`;
E10 `puzzles/signals.toml`; E11 `systems/porter.toml`; E12 `puzzles/store-room.toml`, `hud/play.toml`;
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
  record); and reading it with its editor's codec (the level's `af-codec`, the TOML session, the character codec of
  S4) and writing it back with no edit gives the same bytes. Expected: FAIL, files with no row.
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

### Task S4: Characters opens a character file (three sessions)

Stress row 3, the editor's half. Waits for C1 and v2's tasks 2 to 4.

**Files:** `packages/editor-3d/src/features/studio/` (a painted stage beside the mesh one, the character codec, the
inspector made from `characterFileSchema`), its unit and browser tests, `packages/editor-3d/README.md`.

- [ ] **Session 1, failing first:** the codec reads `traveller.toml` and writes it back byte for byte; changing the
  coat's `length` writes a one-line diff. Then the Studio lists `content/characters/*.toml` as cards.
- [ ] **Session 2, failing first (browser):** opening a card draws the painted figure at density 2, turned by a
  control through 8 directions, on a ground line; the outfit, hair, gait and cap are choices filled from the kit's
  registries; an unknown name in the file is shown as a problem that names the field.
- [ ] **Session 3, failing first (browser, phone):** at 390 × 844 every control is at least 44 px, the figure stays in
  view above the sheet, focus survives rotation; a change is seen in the running game after Save (the content the dev
  server serves changes).
- [ ] Gates after each session, `pnpm test:browser:3d`; commits.

### Task S5: A journey for each editor (two sessions)

Waits for v2's task 6, E14, S1 to S4.

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
| 3 | Characters cannot open a painted character | S1's character rows, S5 | C1 and S4 here (Q4) |
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

- Every path is either on `main` today, on a branch this plan waits for, or created by an earlier task: F1 creates
  `examples/set-3d` and `catalog.ts`'s rule before any task writes there; C1 creates the character kind before C3, C4
  and S4; F2 before L4; E1's harness before E2 to E13; E7's `nav` file before E11 and E12.
- No two parallel branches own one file (the table under "In parallel, by folder"). The level file is written by the
  place branch, then C5, then E7, in that order, never at once.
- Totals: 3 + 7 + 5 + 15 + 5 + 1 = 36 tasks; sessions 4 + 7 + 5 + 10.5 + 7.5 + 1 = 35 (Opus: L1 to L4 are 5, C3 to C5 are 3, O1 is 1).
- No task opens, judges or ports an old example: deletion is `git rm` by the paths in the list.

## For the tracker

Text for `docs/superpowers/progress.md`, not applied by this session:

> **Workstream: one example set (3D).** Spec `specs/2026-11-13-one-example-set-design.md`; survey
> `audits/2026-11-13-example-set-survey.md`; plan `plans/2026-11-13-one-example-set.md`. Stage 2 (plan) done
> 2026-11-13 on `claude/example-set-plan`; stage 3 (plan audit, Opus) is next. 36 tasks, 0 done (0%), about 35 build
> sessions (9 Opus). Thirteen examples and a story replace 21 examples, the wardrobe package and the old 3D story.
> Can start now: F1 (the shape) and W1 to W3 (seven prop generators, two CC0 photos). Waits on: camera, ada and the
> night fix on `main` (the kinds, the place, the cast); ship-3d B10 and the Owner's yes on the sheets (every example);
> editors v2 tasks 2 to 4 and 6 (the editor fixes and journeys). Open questions for the coordinator: Q1 to Q8 in the
> plan; the ones that change scope are Q2 (`interact` and `hud` public), Q3 (the whole-pixel field and the look file
> lifted from the game) and Q4 (who closes stress rows 2 and 3). Part 5 (2D from Emberwick, about 15 sessions) waits
> on the Owner's yes.

## Log

| Date | Session | Task | What happened | Commit |
|---|---|---|---|---|
