# 3D slice refactor: design spec

- **Stage:** 2 of 6 of the 3D slice (spec and plan), rewritten on 2026-11-07 with the superpowers plugin
  (`superpowers:brainstorming` for this spec, `superpowers:writing-plans` for the
  [plan](2026-11-07-3d-slice-plan.md)). It replaces the first version (PR #443, written by hand while the plugin did not
  load) and folds in the 21 verified findings of the paused plan audit (branch `claude/project-thread-ywnoq6`,
  `docs/refactor/2026-11-07-3d-slice-plan-audit-notes.md`; "audit note N" below). Finding IDs S1 to S10, K1 to K3, E1
  to E6, V1 to V5, T1 to T6, G1 to G7, Q1, Q2, W1, W2, C1 to C10 and B1 to B10 point at the
  [audit](2026-11-07-3d-slice-audit.md) (PR #442).
- **Checked against:** the checkout at #443's head (`ac899051`), FigureBuilder `025ffb4` and EnvironmentBuilder
  `6d82a52` (both heads on 2026-11-07).
- **Path:** architectural (new package, new contracts, restructured editors). The brainstorming gates (questions, the
  approach, the sections, the written-spec review) are met by the Owner's recorded words, not by a new round of
  questions: "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals"
  (2026-10-31). The user's rule wins over the skill's gate (the skill's own priority rule). The spec is accepted once
  the stage 3 audit's fixes are in.
- **Stage 3 audit (2026-11-07):** audited against #444's head (`64c27c91`) and both builders at the same commits; its fixes
  are in sections 6 to 11 and 15 here and in the plan ([record](2026-11-07-3d-slice-plan-audit.md)). Accepted under
  "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals" (Owner, 2026-10-31).

> **Scope trim, 2026-11-07 (Owner, 19:28): "Make sure we're not overscoping 3D, it should be as lightweight as 2D,
> everything else should go into plus".** Sections 3, 6, 7, 8.2 and 9 are narrowed by
> [2026-11-07-3d-scope-trim.md](2026-11-07-3d-scope-trim.md): core draws a game's own data and ships no ready-made
> library; the prop, swatch and kit libraries, the dresser, decals, lettering, generated maps, the photo pipeline, the
> declared `reads`, sky, stars, rain and bloom go to `@automata/world-kit`, and eight garment kinds, the hair pieces and
> seats to `@automata/character-kit` (both Plus port extensions). The CPU reference painters are not written. Where a
> section below and the trim document differ, the trim document wins.

## 0. What the Owner wants (the brief)

**Said by the Owner:**

- "we do the editor refactors that 2D touch and website refactor as if it's ready to ship with 2D alone, then we do the
  same for 3D" (2026-11-06); "Yes start the 3D work" (2026-11-07 10:37).
- The order (10:38): "Let's do the same workflow for 3D as we did for 2D; fix 3D, then the other automata stuff that
  uses 3D, then editors, then site".
- The process (10:43): "Of course still do the plan, plan audit, execute, execution audit, fix audit cycle too; refresh
  at 90mins, native not agents and all that".
- 3D tests must run (10:36): the `3d` workflow stays on; the 8 known 3D editor failures are fixed. First release is
  0.1.0.
- The builders: "Pull from the figurebuilders repo and environmentbuilders repo, they were updated substantially";
  D10: "Their pixel-art look too", "Take everything basically", then "We use pixi3D, and 2D should also use the duel
  palette".
- Views (11:04): "the diorama, first-person and top-down views sounds more like they should be in the editor and not
  3D".
- Standing: editors have essential features only (2026-11-06); slightly rounded corners, never pills; the drunk grandma
  test for all copy and UX; feature folders with tests in their own folder; no subagents; "We MUST use superpowers".

**Assumed here (each is a veto default, section 15):** D1 to D9 taken on the audit's recommendation (A); the package
is `@automata/3d`; DUEL covers game art and the game UI theme but not the editors' and the site's chrome; the game is
called Ember Hall; budgets 30 fps phone, 60 fps iPad.

**Success, in one sentence:** someone makes a 3D game, edits its level and its hero in one redesigned editor suite on
a phone, an iPad or a computer, sees the change in the game, and (once Pixi 3D is public) publishes it; the 3D code is
one feature-grouped package that holds everything from both builders, drawn by Pixi 3D in their pixel-art look on the
DUEL palette; the site shows 3D beside 2D.

## 1. What done looks like

Each is checked by a command, a journey or the Owner:

1. **The 3D gate runs and is green.** `pnpm check` and `ci.yml`'s core job run every unit test, 3D included; `3d.yml`
   runs the 3D browser suites in Chromium, WebKit and Firefox and the 3D journeys in Chromium and WebKit in three jobs;
   the 8 known failures are fixed, not skipped (T1, T3, Q1).
2. **One 3D package, `@automata/3d`** (`packages/3d`) holds the renderer, the camera, the figures, the timeline, the
   stage, the world builder, the level format and the look, in `--features` layout with tests in `tests/`.
   `render-pixi3d`, `figures` and `sector-format` are gone (D2, S1 to S3, S9).
3. **No Effect** in `packages/3d`, its testing entry or base-3d (S4).
4. **Everything from FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52` is in AF**, ported by hand.
   `docs/provenance/sources.md` holds one row per source file (code, library JSON, scripts, photos) with its AF path or
   why it was left out, checked against a committed manifest of both trees (D9, D10, B1 to B10).
5. **The 3D look is the builders' pixel-art look, drawn by Pixi 3D** through the game's camera. No CPU painter draws a
   frame in a game or an editor page; the painters survive only as the offline reference the look's tests compare
   with (section 6).
6. **DUEL is AF's palette** (32 ramps of 8): `@automata/content`'s `DEFAULT_PALETTE`, Emberwick's art, the game UI
   theme, the examples, the 3D swatches, the editors' game-art colours and `docs/art/`; Endesga 64 is gone from code.
7. **One timeline and one level format.** One keyed-track model carries figure clips, actions, camera tracks and scene
   state; `evaluate()` is the only figure player. One level format, `af-sector/2`, read by the game, the editor and the
   world builder through one schema.
8. **The base 3D game opens in the editor.** `automata editor games/base-3d` opens its room in Levels 3D and its hero
   in Characters; Save changes the game's files; `automata check` passes; the game shows the change. A journey proves
   it against the real command on a temporary copy (E1 to E3, T2).
9. **One editor app** (D4): one suite on the game's folder, listing only what the game has; the standalone 2D and 3D
   pages and `--app` are gone.
10. **The 3D editors work on a phone** (D5) at 390 × 844 and 844 × 390; every bar action is whole, inside the screen
    and uncovered, checked by a layout rule on every screen (V1, V5, T5).
11. **The 3D editors look like the approved mock-ups** and use only the kit's tokens (V2, V3).
12. **Every word passes the drunk grandma test** (section 10): no format ids, paths, plan IDs or source names on screen.
13. **Essential features only** (D6): World, Ask and the change-set desk are gone; every core authoring feature stays,
    the builders' new ones included.
14. **The site shows 3D beside 2D** (D7), built and tested behind the closed-beta switch (W1).
15. **Publishing waits for Pixi 3D** (D1, W2): the release PR is written and rehearsed; it merges on the Owner's trigger.
16. **No plan IDs or source names in code and tests**; `pnpm source-names` reads code; every 3D package and the game has
    a README (S8).
17. **`docs/refactor/progress.md` says 100% for this slice** (15 and the Owner's device runs excepted).

**Unchanged:** the sim's laws (Koota, no I/O, no wall clock, no `Math.random`, no Effect); cross-engine determinism of
base-3d's golden replay; the vendored `@pixi/3d` 0.1.0-beta.2 and its launch rule; `automata editor`'s server rules
(loopback, token, `Host` check, mtime guard); the kit's document model; the 2D editor and `.af2d.json` (it only moves
into the one suite); the host contract (ADR 0006).

## 2. Approaches considered

| Question | Options | Chosen, and why |
|---|---|---|
| Packages | (A) one `@automata/3d`; (B) keep three | A (D2): the three always change together; one boundary rule set, one API report |
| Builders' code | (A) port by hand into AF's folders; (B) vendor as submodules | A (D9): AF owns its copy; the record makes a later pull a scoped diff |
| The look | (a) Pixi 3D passes; (b) offline bake of sprites and textures; (c) CPU painters at runtime | Measure (a) and (b), take (a) if it holds the phone budget, else (a) for the world and (b) for figures (ADR 0007). (c) is out: the Owner said "We use pixi3D" |
| Timelines | (A) one keyed-track model; (B) keep three adapters | A: three players drift; one key, one ease set, one sampler |
| Levels | (A) `af-sector/2` with the builder's fields; (B) read both formats | A: one schema for game, editor and world; the builder's maps are converted once |
| Views | (A) the builders' three views in the editor; (B) in the 3D core | A (Owner 11:04): the core keeps only the game's camera |
| Photo pipeline | (A) in `-tools` (Node); (B) a `@automata/3d/photo` entry | A (audit note 13): the published `-tools` may not depend on the private 3D package, and the pipeline needs no `@pixi/3d` |

## 3. Scope

**In, by part (section 12 has the order):**

- **Part A, the 3D core:** the gates; `packages/render-pixi3d`, `packages/figures` and `packages/sector-format` merged
  into `packages/3d`; Effect out; the cuts; DUEL in `@automata/content` and every consumer; the port of both builders;
  the look; `automata textures`; words and provenance.
- **Part B, the rest of AF that uses 3D:** `games/base-3d` (Ember Hall), `examples/3d`, `create-game`'s 3D template,
  `automata editor`'s policy, the agent package's 3D parts, `docs/`, the 3D frame-budget projects.
- **Part C, the editors:** `packages/editor-3d` (Levels 3D and Characters), the one suite page, the suite's phone layout,
  `docs/design/editor-3d` archived.
- **Part D, the site** and the release phase.

**Out:** Plus (its sim level reader, `sectors`, and its cutscene director, `cutscenes`, are extensions, per the Plus port spec section 9); the paid editor apps; the 2D editor's own features; rigged glTF characters; networking; any 3D feature
neither builder nor the audit names.

## 4. Owner decisions, as taken

| ID | Taken | Meaning here |
|---|---|---|
| D1 | A | Finish 3D on the vendored beta; publish 3D as the last phase, the day `@pixi/3d` is public |
| D2 | A | One package `@automata/3d`; `editor-3d` stays its own private package |
| D3 | A | The source game's blockout and facility formats are deleted; the editor opens `af-sector` files only |
| D4 | A | One editor app; `create-game` and base-3d get an editor list |
| D5 | A | Full authoring on a phone |
| D6 | A | Keep drawing, Plan, 3D and Walk, the checks, Undo, Save, Look, Pose and Animate; cut World, Ask, the change-set desk; streetwear leaves core for an example |
| D7 | A | The site grows by dimension |
| D8 | inputs | The Owner's: Pixi 3D's release or written okay, WebKit and Firefox runs on the Mac, the iPad play-through, DUEL's credit (section 5) |
| D9 | A | Port by hand; record each pull in `sources.md` |
| D10 | C on Pixi 3D | Everything from both builders, the look included, rebuilt on Pixi 3D; DUEL AF-wide |

## 5. Gates first (T1, T3, T5, T6, Q1; audit notes 1, 2, 17)

The gate is fixed before anything moves.

- **Every unit test in the gate.** Root `check` calls `test:unit` (no filter) in place of `test:unit:2d`; `ci.yml`'s core
  job runs `pnpm test:unit` in place of its own `pnpm test:unit:2d` step (line 113), so the hosted gate matches
  (audit note 1). `test:unit:2d` and `test:unit:3d` stay as local loops. The 3D unit tests add about 95 s.
- **`3d.yml` has three jobs:** `3D - journeys` (the editor's journeys and the base-3d and examples e2e, Chromium and
  WebKit installed once), `3D - parity (chromium, webkit, firefox)` (`test:browser:3d`) and `base-3d through game-ci`.
  The `3D - unit` part of today's first job goes, since `ci.yml` now runs it (audit note 2). Its `paths` list gains
  `vendor/pixi-3d/**` and keeps every entry it has (`agents/**`, `pnpm-lock.yaml`, the workflow file).
- **#425's timeout fix is carried:** every `test:browser*` script runs `--concurrency=2` and `--hookTimeout=90000`;
  `gate-scripts.test.ts` holds it. #425 is then closed as carried (its branch is the Owner's to delete).
- **The seven `open-flows` failures:** the kit's `Dialog` owns the dialog's scroll region; editor-3d's `ErrorPanel`
  takes `inDialog` and declares no second region inside a dialog; the test reads the problem list by role and name.
- **The Pencil failure (iPad mini landscape):** fit-to-room frames the room inside the plan's *usable* rectangle (the
  stage minus the sheet and the floating tools, from the kit's geometry owner); the test draws inside that rectangle,
  read from the page.
- **Journeys in Chromium too:** editor-3d's journeys project lists Chromium and WebKit.
- **Every action whole and inside:** `checkLayout` already has `findOffscreenControls` and `findClipped` (for
  `[data-row]` only). `findClipped` extends to every `button`, `a`, `[role=tab]` and `[role=menuitem]` inside
  `[data-region="topbar"]`, `[data-region="rail"]` and `[data-region="panel"]` (and `dock` and `tools` once part C adds
  them), and a new `findCovered` checks `elementFromPoint` at each one's centre is itself or inside it (audit note 17).
  It fails on the Studio's clipped Publish (T5) until part C fixes it.
- **Paraglide never empties its folder (T6):** `compileInFolder` compiles into a temporary sibling folder, copies files
  whose bytes changed, deletes files that are gone, then removes the temporary folder. An unchanged compile writes
  nothing.

## 6. The look on Pixi 3D (D10, B4, B8)

- **Measured first** (ADR 0007): (a) *passes*: render into a low-resolution target (320 × 180 at 16:9; the short side is always 180 and the long side follows the
  stage, so a phone in portrait at 390 × 844 draws 180 × 390, and the target is rebuilt on a resize and after a
  context loss), a material
  quantises light into ramp steps, a post filter snaps each pixel to its DUEL ramp and draws outlines from depth and
  normal edges, the target is drawn nearest-neighbour; (b) *bake*: offline sprite cells and textures drawn as
  billboards. **Rule:** (a) if it holds the phone budget with the camera turning; else (a) for the world and (b) for
  figures. If the beta takes no custom material, (a) quantises in the post filter from a lit buffer.
- **The passes** live in `features/look/`: `look.ts` (the view's settings from EnvironmentBuilder `paint/library/
  look.json`: pixel size, ramp steps, outline, dither, grade, the switches), `ramp-light.material.ts`,
  `duel-snap.filter.ts`, `outline.filter.ts`, `sky.ts`, `rain.ts`, `post.ts`, and `sprite-light.ts` (figures lit as one
  flat sprite: a flat light at the chest, a one-step form, a rim). Each filter is a GLSL + WGSL pair taking pixel
  position from the vertex stage; WebGL2 at parity with WebGPU.
- **One time of day** (audit note 9): FigureBuilder `lighting/library/times.json` and EnvironmentBuilder
  `paint/library/times.json` share six names (day, golden, dusk, night, lampLit, bar) with different fields. They merge
  into one `time-of-day` content kind in `shared/time-of-day/` (schema plus the merged library): each entry holds the
  scene's light, haze and grade (EnvironmentBuilder's fields), the figure's key, fill and bounce (FigureBuilder's) and
  a `label`, the words the editor shows (Day, Golden hour, Dusk, Night, Lamplight, Bar light).
  The look and the figures' lighting both read it; a level names one.
- **The reference:** both painters (FigureBuilder `paint/{paint,raster,fabric}.ts`, `lighting/light.ts`;
  EnvironmentBuilder `paint/*`, `view/render.ts`, `view/fp.ts`) port to `src/testing/look-reference/` as plain
  TypeScript with no globals. They are the oracle of the look's parity test (Pixi 3D and the reference agree within a
  named palette-index tolerance) and, if ADR 0007 picks (b), the body of a Node bake script under `scripts/`. They are
  kept out of every product entry: `--features` rule 5 already stops product code importing `testing/`, and
  `entries/testing.ts` re-exports only `testing/public.ts`, which does not reach `look-reference/` (audit note 14). A
  unit test in `packages/3d/tests/unit/entries.test.ts` walks each entry's import graph and fails on `look-reference`.
- **Views are the editor's** (Owner, 11:04): the core keeps the game's camera (24 mm, 25° down, 5 m back, turned freely)
  and the look draws through whatever camera it is given. EnvironmentBuilder's top-down, diorama and first-person views
  become Levels 3D's Plan, 3D and Walk in `editor-3d`, with `view/view-frame.ts` and `view/readability.ts`. `view/shots.ts`
  (shots and sequences on one clock) goes to the core's stage, since a game plays it.
- **Frame budget:** 33 ms at the phone profile and 16.7 ms at a new iPad profile (`frame-budget-ipad`, 1194 × 834),
  measured by new Playwright projects in `tooling/frame-budget` on a 3D stress page (`stress/3d/`) of the game's room
  with Wick and every pass on, with exclusive GPU access (audit note 15). A software renderer skips and says so. The
  hero's first pose (5 ms, G7) is measured on the same page and met or changed to the measured number in section 15.

## 7. Package layout and the feature rule (audit notes 3, 4)

```text
packages/3d/
  src/entries/    index.ts (.), sim.ts (./sim), level.ts (./level), figures.ts (./figures), camera-view.ts,
                  no-eval.ts, testing.ts
  src/app/        create-renderer.ts, render3d.extension.ts, figures.extension.ts, compose-scene.ts
  src/features/
    renderer/     the Pixi 3D app's own parts: context loss, bundles, no-eval
    camera/       the game's camera (angled camera, driver, pose, fov, camera-view content), occluders/ (what fades
                  between the camera and the hero) and sim/ (camera heading: component, plugin, turn command and
                  system, view schema, heading, stick mapper, view latch)
    look/         the passes (ramp light, DUEL snap, outline, sky, rain, post, sprite light)
    figures/      body/, motion/, hair/, outfit/, figure/, lighting/, clips/, content/, registry/, view/ (the Pixi
                  meshes of a figure: meshes, colour, skin, joints, decals, figure view)
    world/        the world builder and library/ (kits, props, swatches, glyphs, maps, tiles)
  src/shared/     math, parity helpers, render/ (what every feature draws through: the render views box, mesh,
                  pose-3d, shared material and view-3d; model loading and geometry; light: lamps, occlusion, scene
                  light, vertex light and bake, fog), timeline/ (keys, eases, sampling), level/ (the af-sector schema,
                  its types, the migration, occlude, the level problem, piece states), time-of-day/
  src/testing/    public.ts (fixtures, golden checks), look-reference/
  tests/          unit/, browser/ (parity, goldens, look), fixtures/
  scripts/        record-goldens.ts, convert-builder-maps.ts
```

- **The `--features` rule holds:** a feature imports only itself, `shared/` and packages. What two features share is
  in `shared/`: the timeline (figures and stage), the level (world, renderer, camera), the time of day (look and
  figures) and `render/` (today the render views import the light, the model loader imports the shared material,
  and the figure view, the camera driver and the occluders import the render views, so these are the shared base, not
  one feature's). `app/` composes: `app/create-renderer.ts` (today's `create-pixi3d-renderer.ts`, which imports the
  camera, the occluders, the light and the models) builds the app, gives it the look's passes and the figures' views,
  draws the world's pieces (`app/world-view.ts`) and applies a change of their states (`app/update-pieces.ts`), and
  gives the scene a `startClip` callback for an extension's cues, so no feature imports another. The renderer's 11 imports of `figures` today
  become the figures' own `view/` folder, composed in `app/compose-scene.ts`.
- **The sim:** `"automata": { "simEntries": ["./sim"] }`; `entries/sim.ts` re-exports `features/camera/sim`
  only (what the sim reads from a level is the `sectors` extension's). `pnpm boundaries` lists `packages/3d/src/features/camera/sim`, `packages/3d/src/shared/level` and
  `packages/3d/src/entries/sim.ts` under the sim's rules.
- **Other rules:** `--features packages/3d`, `--forbid packages/3d:effect`, `--platform-imports` (no `node:` under
  `src/`), `style --plan-comments` and `--test-imports` for `packages/3d`.

## 8. Figures, the wardrobe, the timeline, the stage (B1 to B5, B9, B10; audit notes 7, 8)

### 8.1 Figures

`features/figures/` takes FigureBuilder's folders: `body/` (genes, head, parts, rig), `motion/` (motion, presets),
`hair/`, `outfit/` (garments, items, fit), `figure/` (cast, cloth, frames, figure), `lighting/` (grade, lamps, light).
AF's figures code moves into those folders once, in phase 2. Where both have a version, FigureBuilder's newer one wins
unless AF's has a behaviour AF's goldens rely on; the choice is written in the file's `sources.md` row.
FigureBuilder's `base/base.ts` (the base pair, one man and one woman) comes in as a test fixture
(`tests/fixtures/base-pair.ts`), the figures every look change is judged on (audit note 8).

Meshes come from the generator (AF's way); fabrics are tone-label tiles sampled as a texture; the face's marks (eyes,
lips on a two-row chin, brows) are a small texture on the head made by the painter's own rules (B4).

### 8.2 The registries and the wardrobe

The five registries come from their real homes (audit note 8): `registerGarment` and `registerOutfitHooks`
(`outfit/garments.ts`), `registerHairPiece` and `registerFinish` (`hair/hair.ts`), `registerFabric` (`paint/fabric.ts`).
In AF they are `features/figures/registry/*.registry.ts`, exported from `@automata/3d/figures`, and an extension calls
them from its `setup`.

- **The classic set stays core** (audit note 7): AF's `garments/classic.ts` and `dress.ts` (the 15 classic kinds:
  apron, belt, cap, cape, coat, eyes, gloves, hair, legs, mark, shoes, skirt, top, trousers, waistcoat; Wick wears top,
  trousers, shoes, cape and cap) is core, registered by `figures.extension.ts` through the registries. So Wick needs no
  extension of base-3d's own, and the `figure-headwear` kind folds into the garment registry.
- **Where the port moves today's figures** (stage 3 audit): AF already has `fat` (default 0.4; Wick 0.3), and
  FigureBuilder's newer `fat` also swells the limbs, the neck and the jaw (each multiplier exactly 1 at fat 0). Taking
  it (the newer one wins) moves Wick and every figure with fat above 0, so the figure goldens are re-recorded once, in
  a named commit, with the images explained; the sim's replay hash does not move. The genes FigureBuilder added
  (`bust`, `seat` and the three eye genes at 0.5, `bodyAsymmetry` and `asymmetry` at 0) keep every figure as it is at
  their defaults; FigureBuilder's `asymmetry` is AF's `faceAsymmetry`. A figure that names a stand keeps it; the
  natural stand is the stand of a figure that names none.
- **Streetwear leaves core after the registries land** (phase 6, task 6.5; not phase 4): today it is typed into core's
  `figure/garment.schema.ts`, `garment-defaults`, `swatch.schema` and `classic.ts`. It moves to
  `examples/3d/wardrobe/`, registered by `wardrobe.extension.ts`. `examples/3d` gains a Vitest unit project for its test.

### 8.3 One timeline, one stage (B5)

- **`shared/timeline/`** owns the key `{ t, value, ease? }` (no ease is linear), the eases (AF's set, the
  cubic-bezier tuple included, plus EnvironmentBuilder's `smooth`; its `hold` reads as `step`, and its key's `v` as
  `value`) and sampling. A clip's content keeps its `{ t, pose, ease? }` keys; they compile to `Key<Pose>`. A track is a sorted list of keys of one value type; sampling is pure (a frame at
  `t` is the same drawn first or alone). A value a track cannot interpolate (a lamp's style) is a stepped track.
- **Figures:** a clip is a set of tracks over poses; `evaluate()` is the only player. FigureBuilder's actions
  (`actors/{actions,pose-spec}.ts`, `library/actions.json`) become a `figure-action` content kind whose entries compile
  to clips.
- **The pieces' states** (`shared/level/piece-states.ts`, `app/update-pieces.ts`): doors, lamps and props each have a
  state a track can drive; `updatePieces` applies a change of it. The director, the `stage-script` content kind (camera,
  doors, lamps, time of day, grade, props and cues that start clips) and the sequences are the `@automata/cutscenes`
  extension's (Plus port spec section 9), which reads no clock and holds no gameplay state either.

### 8.4 Provenance and pulling again

`docs/provenance/sources.md` gets "The figure source" and "The environment source": repository, the full commit, the
licence fact (none recorded: the Owner's private repositories), the pull procedure, and one row per file of
`docs/provenance/builders-manifest.json` (written from `git ls-files` at the two commits). A row is *ported*,
*rewritten: what*, or *left out: why*. Left out on purpose: EnvironmentBuilder's `vendor/FigureBuilder` submodule (its
door `lib/figure.ts` becomes AF imports), `docs/reference/`, both `docs/superpowers/`, review tooling.

**Scripts** (audit note 11): EnvironmentBuilder `scripts/check.ts`, `checks.ts` (swatch and map `reads`:
`photo/structure.ts checkReads`, `view/view-frame.ts frameIssues`) become a pure `checkReads` in
`@automata/3d/level`, shown by Levels 3D's checks and run by the game's own content test (so the published `-tools`
keeps no 3D dependency); `textures.ts` and `photos.ts` become `automata textures`; `render.ts`,
`board.ts`, `sheet.ts`, `lit.ts`, `save.ts`, `map.ts` become `packages/3d/scripts/look-sheet.ts` (contact sheets from the
reference, for a reviewer); `tune.ts`, `tune-light.ts` and `src/lib/search.ts` are *left out: a tuning aid for the
builder's own swatches; AF tunes through the Tuner*; `golden.ts` is AF's `record-goldens.ts`. FigureBuilder's
`render.ts`, `lit.ts` and `actors-demo.ts` fold into `look-sheet.ts`; its `golden.ts` into `record-goldens.ts`.

Pulling again: clone the builder, `git diff <recorded>..<new> -- <the rows' source paths>`, port each hunk (tests first),
add new files as rows, record the new commit. `source-names` learns EnvironmentBuilder's name and reads code.

## 9. One level format: `af-sector/2` (B6, B7, K2; audit notes 10, 12)

- **Owner:** `shared/level/` (the former `sector-format`), exported as `@automata/3d/level`, its schema, migration and types (the sim part is the `sectors` extension's).
- **`/2` = `/1` plus these, field by field from EnvironmentBuilder's `world/types.ts`:**

| EnvironmentBuilder field | `/2` field | Note |
|---|---|---|
| `MapPlan.id`, `name` | file name, `name` | as `/1` |
| `sectors` | `sectors` | AF's `corners` (with walls) and `holes` stay; `verts`/`rect` and walls by edge index are converted, not read |
| `Sector.floor`, `ceil` (`Plane`) | `floor`, `ceiling`: a number or `{ z, slope?, sky?, surface? }` | a number reads as `{ z }` |
| `Sector.shade` | `light` | `/1`'s light level |
| `Sector.grime`, `MapPlan.grime` | `grime` on the sector and the level | presentation |
| `Sector.door`, `doorState` | `door: { open?, near?, speed?, into?, hinge?, surface?, handle? }`; its state is stage content | `shown` left out (a view detail) |
| `Sector.dress`, `MapPlan.dress` | `dress: { as, density?, seed?, grime?, keep?, remove?, pin?, surfaces? }` | `dressed` left out (a cache flag) |
| `MapWall.swatch`, `upper`, `lower`, `trim`, `skirting`, `dado`, `rail`, `cornice`, `none`, `decor` | on the corner's wall: `surface`, `upper`, `lower`, `trim`, `skirting`, `dado`, `rail`, `cornice`, `none`, `decor` | `/1`'s `texture` reads as `surface` |
| `walls[edge].windows` (`WindowGrid`) | the wall's `windows` | |
| sprites with `use`/`kind` | `props: [{ id, use, at, angle?, with?, layer? }]` | |
| sprites with `who`/`pose` | `cast: [{ id, who, pose?, at, angle?, to? }]` | presentation; the sim's things stay `entities` |
| sprite `diorama` | left out | the editor's 3D view shows every layer |
| `lamps` | `lamps: [{ id, kind, at, … }]` | kind from the look's lamp kit |
| `time` | `time`: a name from `time-of-day`, or a name and overrides | |
| `visibility`, `grade` | `look: { visibility?, grade? }` | |
| `views` | `views`: named cameras; the game's go here (base-3d's `ROOM_VIEWS`), the editor's are its own | |
| `paths` | `paths: { [name]: [x, z][] }` | stage scripts walk along them |
| `horizon`, `layers` | `sky: { horizon?, layers? }` | parallax sky |
| `seed` | `seed` | seeds generated maps and dressing |
| `reads` | `reads: { minEdge?, hot? }` | read by the checks |
| — | `decals`, `lettering` | from `world/decals.ts`, `lettering.ts` |
| — | `zone` on a sector | a name the sim's rules can read (Plus's clinic uses it; the `sectors` extension reads it) |
| — | `masses` on the level | solid blocks that are not sectors (the clinic's) |
| — | `cut`, `hideFrom` on a corner's wall (`AfWall` stops omitting them) | which part of a wall is cut away and which views hide it |
| — | entity definitions with `fields` (EG-2); pits as a sector flag `pit: true` (EG-3) | AF's own gaps |

- **Migration:** `shared/level/af-sector-1-to-2.migration.ts`; the editor opens a `/1` file, says "This level was made
  with an older version. Saving updates it.", and writes `/2` on Save, never on open. base-3d's room is migrated in the
  same PR.
- **The builder's maps** (`maps.json`, the base scenes) are converted once by `scripts/convert-builder-maps.ts` into
  `/2` files under `features/world/library/maps/`; no runtime code reads the builder's shape.
- **The world builder** (`features/world/`) turns a `/2` level into renderer-free pieces. Its generated maps
  (`apartment@<seed>`, `block@<seed>`) take AF's seeded rng, never `Math.random`. The library files are content kinds
  (`world-kit`, `world-prop`, `world-swatch`), so a game adds its own.
- **What it replaces** (audit note 12): base-3d's box room (`src/content/levels/sector-area.ts` → `AreaSource` boxes,
  `ROOM_VIEWS` in `src/content/room.ts`) and editor-3d's `view/mesh/sector-mesh.ts` both draw through the world builder.
- **Problems:** the level, the world builder and the checks report a `LevelProblem` (`shared/level/problem.ts`): content's
  `Problem` (`path`, `code`, `message`, so `automata check` places it in its file) plus `where` (the room, prop or lamp
  id) and `name` (the missing kit, prop, swatch or time). Nothing in them throws on a level it cannot build.
- **The game-facing meaning (K2):** what the sim reads (floors, walls, pits, things and their fields, spawn) is the
  `sectors` extension's reader (Plus port spec section 9), not built here; dressing, lamps, decals, time, views, cast and sky are presentation.
- **Surfaces and photos** (audit note 13): a swatch names a DUEL ramp and step, or a tile. The photo pipeline
  (EnvironmentBuilder `photo/`, `lib/png.ts`) is `packages/tools/src/features/textures/`, Node-only, run by
  `automata textures <photos> --out <folder>`. The library's photos (Poly Haven CC0, 2.9 MB) live in
  `packages/3d/assets/photos/` with `photos.json` and their credits, outside the package's `files`; the tiles are
  committed beside the world library, each stamped with its photo's hash, and `automata check`'s
  `packages/tools/src/shared/check/` reports a stale one.

## 10. The editors

### 10.1 One suite (D4, E2 to E5)

- `automata editor [folder]` opens one page on the game's folder, listing what `content/editors.toml` names: Levels for
  `*.af2d.json` and `*.af-sector.json`, Characters for `content/figures/*.toml`, the Tuner for `tuning.toml`. Without a
  list, the policy reads level files of both kinds.
- `packages/editor` keeps the 2D-only suite page; `packages/editor-3d` builds the full page (the suite plus Levels 3D and
  Characters). The command serves the full page when the game has a 3D file and the 3D build is present, else the 2D
  page. `--app`, `packages/editor-3d/src/main.ts` and `packages/editor/src/app/editor-2d/` go. A published `-tools`
  packs only the 2D page until the release.
- The suite opens the checkout (`openSuitePorts`); the sample game is the site's try-it page only, and gains a 3D room
  and Wick.
- The change-set desk, Ask and World go (D6, E6); editor-3d's root and `./suite` entries go (E5).

### 10.2 Inside `editor-3d`

- `--features` layout: `app/`, `entries/`, `features/levels-3d/{plan,views,walk,dollhouse,inspector,things,definitions,
  checks,document,home}` (`entities/` becomes `things/`), `features/studio/{look,pose,animate,stage}`,
  `shared/{geometry,edit,level-session}` (`model/` becomes `shared/edit/`, `profile/` and `codec/` become
  `shared/level-session/`), `testing/`;
  tests in `tests/{unit,browser/{layout,canvas,journeys},e2e}` with `#src/…` imports, as `packages/editor` has them (the
  test mover puts a DOM test in `unit/` with the jsdom directive; there is no `dom/` folder).
- The source game's format goes (D3): `format/`, `profile/last-light-*`, `checks/facility/`, `checks/last-light/`,
  `model/facility-*`, `testing/{toy-blockout,shipped-facility}.ts`, the `blockout` entry. One profile stays, so
  `profile/registry.ts` becomes a plain import.
- `suite-content-shim.ts` imports `@automata/content/schema` and `/palette`, then is inlined (one caller).
- Only the kit's tokens: the 14 missing tokens get their kit names, `--radius*` and `--pill` become `--edge-sm/md/lg`,
  and a style rule fails on a `var(--x)` neither the kit nor the file defines (V3).

### 10.3 The redesign (V1, V2, V4, V5, D5)

From `refactor/2026-11-06-redesign-mockups/editor-level.html`, phone first:

- **Levels 3D's views:** Plan (top-down), 3D (the diorama), Walk (first person), each a Pixi 3D camera over the game's
  look, framed by the ported framing math; Walk says when a figure does not read ("Wick is hard to see here").
- **Levels 3D:** top bar = Back, the game and level menu, the views as quiet tabs (a menu on a phone), Undo, Redo,
  problems, the save status and one lime primary (Save); tools float top centre as icons with accessible names (Select,
  Room, Corner, Doorway, Door, Window, Thing, Furniture, Lamp); the label-left inspector shows the level when nothing is
  chosen; wide, medium and compact layouts by the container, compact with the tools in a dock and the inspector and
  layers in sheets; one eye and one lock icon per layer row (C8).
- **The builders' authoring:** "Fill with furniture" on a room (from the game's `world-kit` content), props, lamps, the level's
  time of day, a wall's trim and windows; each one inspector field or one tool.
- **Characters (the Studio):** the same top bar; on a phone Undo and Redo go into the menu, the panel toggles become one
  Panels button, Dock goes, Publish becomes Save; Look gains the body, face and hair controls; Animate edits actions as
  clips; thumbnails are drawn by Pixi 3D into a render texture.
- **Home:** the kit's Home ("What do you want to change?"), files named in words.
- **The suite on a phone (V4):** the top bar names the game; the bottom bar lists only the game's editors, one Levels
  for 2D and 3D; in phone landscape it folds into the top bar's menu.
- **The look:** slightly rounded corners from `--edge-sm/md/lg`, never a pill, hairlines, one lime primary per screen,
  the kit's icons. `docs/design/editor-3d` moves to `docs/archive/design/editor-3d` (S10).

### 10.4 Real journeys (T2)

Playwright journeys in `packages/editor/tests/e2e/journeys/` (the 2D slice's harness, `tests/e2e/harness/`, taught to
copy base-3d as well as Emberwick) start the real `automata editor` on a temporary copy of base-3d (own port, own
folder): open the room, draw a room, furnish it, save, the file changes, `automata check`
passes, the game's dev server shows it; open Wick, change a slider, save, the game shows it; on a phone (390 × 844,
touch) draw a room with the dock and save. Chromium and WebKit.

## 11. Copy (the drunk grandma test)

Every changed string goes in `docs/refactor/copy.md` ("3D editors", "Base 3D"), old and new, and passes: could a drunk
grandma tell what is happening and how to use it?

| Today | New |
|---|---|
| "Read as af-sector. This editor opens af-sector and last-light-blockout." | (gone) |
| "sectors.0.floor Invalid input: expected number, received string" ×40 | "Room 1's floor height isn't a number. Open the room and type a number." (one line per problem, grouped by room, with Show) |
| "This is a sample game, not yours…" in a game folder | (gone) |
| "No projects yet. Import a folder or a zip to start." | "This game has nothing to edit yet." with its one action, "Add a level", in sight |
| Sector, Vertex, Portal, Definitions…, spawn, "51 px per metre", "af-sector" | Room, Corner, Doorway, Thing types…, Start point, (scale hidden), (badge gone) |
| "Nothing to edit in Studio yet." | "This game has no characters yet." with New character |
| "Opened Base 3d in the level editor." | "Opened Ember Hall." |
| Studio | Characters (the code's folder stays `studio/`) |
| New: Furnish as, Time of day, Lamp, Prop, Trim | Fill with furniture (None or the kit's name; Undo says "Undo fill with furniture"), Time of day (each time's `label`: Day, Golden hour, Dusk, Night, Lamplight, Bar light), Lamp, Furniture (the tool; "Thing" stays for what the game uses, so the two never share a word), Wall trim |
| `wick`, `guard-high`, Skin `wick-shadow`, Gait `bounce`, 0.4, Playhead, Add key, Dock | Wick, High guard, Skin "Shadow", Walk "Bouncy", words at each slider end ("Thin" … "Heavy"), Time, Add a pose here, (gone) |
| New sliders | the words at each end: fat "Thin" … "Heavy", bust and seat "Smaller" … "Larger", eye size "Small" … "Large", eye spacing "Close" … "Wide", eye tilt "Down" … "Up", body and face asymmetry "Even" … "Uneven" |
| HUD "● 0", pause "II", no Settings | "Embers 0 of 6", a pause icon named Pause, Settings on the title menu |
| a stale tile | "This texture is older than its photo. Run automata textures to update it." |
| `--app` | "This option is gone: automata editor picks the editors your game needs." |
| `automata create-game --template 3d` before the release | "3D games need a package that is not public yet. For now, make a 2D game: leave out --template." |

The game is **Ember Hall** everywhere (G4); the folder stays `games/base-3d`.

## 12. The site and the release (D1, D7, W1, W2; audit note 21)

- **Behind the switch (`AF_SITE_3D=1`):** Home plays Ember Hall beside Emberwick; Examples has a 3D group; the Editor
  page has "Try the 3D editor"; the docs gain a 3D section; the API page covers `@automata/3d`. Off, the build has no 3D
  route and no `@pixi/3d` byte (the scan proves it). The deployed site keeps it off until the release.
- **The release PR** (written and rehearsed now, merged on the Owner's trigger): npm `@pixi/3d` in place of the vendored
  tarball, `vendor/pixi-3d` deleted, `@automata/3d` public and added to the changesets `fixed` group at the line's
  version with a `patch` changeset, the full suite packed into `-tools`, the closed-beta refusals lifted in
  `ship prepare` and the scan, `create-game`'s 3D template public, the site deployed with `AF_SITE_3D=1`.
- **Versions:** the first release is 0.1.0 (the 2D slice's task 14.2).

## 13. Order and pull requests

Each phase is one PR stacked on the one before (the first on this spec's branch), opened ready. A part's PRs merge
before the next part's first opens for review.

| Part | Phases | What |
|---|---|---|
| A. The 3D core | 1 to 10 | Gates; one package; Effect out; cuts; DUEL; FigureBuilder; the level and the world; the look; textures; words |
| B. The rest of AF that uses 3D | 11 to 13 | Ember Hall; examples and `create-game`; command, docs, agents, budgets |
| C. The editors | 14 to 18 | `editor-3d` by feature; one suite; Levels 3D; Characters; copy and real journeys |
| D. The site | 19, 20 | The 3D pages; the release |

Execution is native and inline, no subagents (the Owner's rule wins over the plugin's subagent-driven default; the
plugin's `executing-plans` is the method). Later stages: plan audit (Opus, medium), build (Sonnet, high), build audit
(Opus, medium), fixes (Sonnet, high), each refreshed after 90 minutes.

## 14. Risks

| Risk | What the plan does |
|---|---|
| Pixi 3D's beta takes no custom material | ADR 0007 checks first; post-filter quantising needs none |
| The look misses the phone budget | Bake figures; drop dither and outline width at the phone profile |
| Files past 600 lines | Split by responsibility as they land; `style` fails otherwise |
| DUEL breaks Emberwick's art | Nearest-in-OKLab, hand fixes recorded, before/after screens, `art.test.ts` |
| `/1` levels in the wild | The migration and the "Saving updates it" line |
| The Mac's CI queue | Three 3D jobs, not four |
| Pixi 3D stays private | Everything but phase 20 merges; the site ships 2D |
| The builders keep moving | The port reads the recorded commits only; a later commit is a planned pull |
| Three time models do not fit one key | The timeline's tests come from all three sources first; odd values are stepped tracks |
| The world builder moves base-3d's picture | The sim reads the same `level/sim` values (replay unchanged); the picture's change is explained with images |
| DUEL's credit is unknown | Not invented: `docs/art/palettes/duel.md` says "source: generated from the DUEL LUT; author and licence: asked of the Owner" until the Owner answers (D8) |

## 15. Veto defaults

1. The package is `packages/3d`, `@automata/3d`.
2. The game is Ember Hall.
3. The look's pixel size is 320 × 180 at 16:9: the short side is 180 and the long side follows the stage.
4. Budgets: 30 fps phone profile, 60 fps iPad profile.
5. `pnpm check` and `ci.yml` run every unit test.
6. `/1` levels are migrated on open and written as `/2` on Save, never silently.
7. Streetwear lives in `examples/3d/wardrobe/`; the classic set is core.
8. The painters stay as the look's offline reference in `testing/look-reference/`, never in a product entry.
9. The photo pipeline is `-tools`' `automata textures`; photos live in `packages/3d/assets/photos/` (not published);
   tiles are committed generated content.
10. Ask, World and the change-set desk are deleted, not hidden.
11. DUEL covers game art and the game UI theme; `tokens.css` keeps the approved 2026-11-06 colours.
12. The Studio is called Characters on screen.
13. The figure, level, world and time-of-day libraries are content kinds (Zod).
14. base-3d keeps `--game` for its sim role files and adds `--features` (audit note 18).
15. `fakeClock` becomes public in `@automata/framework/testing` (API report, `pnpm api-index --write`, changeset; audit note 6).
16. The fat slider takes FigureBuilder's newer reading and the figure goldens are re-recorded once for it (section 8.2).
17. The editor's words: a room's field is "Fill with furniture", the tool that places one piece is "Furniture", and "Thing"
    is only for what the game uses; each time of day carries a `label` (Day, Golden hour, Dusk, Night, Lamplight, Bar
    light).
18. Shared render primitives (the render views, the model loader, the light) are `shared/render/`, the occluders are the
    camera's, and `features/look/` holds only the passes (section 7).

## 16. The code standard

As the 2D slice's section 17: minimal, modular, in existing patterns, small files with one responsibility,
descriptive names, comments that explain invariants and failure policies, never plan IDs or source names. Ported code
is rewritten to AF's conventions as it lands (role suffixes, Zod content kinds, no Node globals outside Node code,
`./sim` under the sim's rules).
