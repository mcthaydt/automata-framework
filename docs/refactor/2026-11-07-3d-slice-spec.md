# 3D slice refactor: spec

- **Stage:** 2 of 6 of the 3D slice (plan and spec). The plan that carries this out is
  [2026-11-07-3d-slice-plan.md](2026-11-07-3d-slice-plan.md); the facts behind it are in the
  [audit](2026-11-07-3d-slice-audit.md) (PR #442). Finding IDs (S1 to S10, K1 to K3, E1 to E6, V1 to V5, T1 to T6, G1 to
  G7, Q1, Q2, W1, W2, C1 to C10, B1 to B10) point at the audit.
- **Date:** 2026-11-07. Drafted on `claude/project-thread-7exkdq`, then reviewed and finished on
  `claude/project-thread-o8dxgf`, stacked on the audit branch `claude/project-thread-xe0752` (PR #442), which sits on the
  2D editors and site stack (#439 to #441). The review checked every path, entry and command against the checkout at
  #442's head and against FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52`, read again for this stage.
- **The Owner's direction:** "we do the editor refactors that 2D touch and website refactor as if it's ready to ship
  with 2D alone, then we do the same for 3D" (2026-11-06); "Yes start the 3D work" (2026-11-07 10:37); and the order,
  2026-11-07 10:38: "Let's do the same workflow for 3D as we did for 2D; fix 3D, then the other automata stuff that uses
  3D, then editors, then site". The spec and the plan are in that order (section 12), and each part is finished before
  the next starts.
- **And the process (2026-11-07 10:43):** "Of course still do the plan, plan audit, execute, execution audit, fix audit
  cycle too; refresh at 90mins, native not agents and all that" (section 12).
- **Decisions it builds on:** the Owner said to start without answering D1 to D8, so each is taken on the audit's
  recommendation (option A), recorded here under the standing rule ("Reminder that everything is auto approved and
  accepted, do not wait on me to do any approvals", 2026-10-31). D9 is taken on its recommendation (A) too. D10 was taken
  by the Owner on 2026-11-07: "Their pixel-art look too", "Take everything basically", then "We use pixi3D, and 2D should
  also use the duel palette". Section 13 says what changes if the Owner later picks otherwise.
- **Also from the Owner (2026-11-07 10:36, relayed):** we are on 3D now, so the 3D tests must run: the `3d` workflow stays
  on, and the 8 known 3D editor failures are fixed (section 4). The first release is 0.1.0.
- **Status:** written and self-reviewed. Stage 3 (the plan audit, Opus medium) reviews it next; it is accepted once that review's fixes are in, under the
  standing rule above.

## 1. What done looks like

The slice is finished when all of these are true, each checked by a command, a journey or the Owner:

1. **The 3D gate runs and is green.** `pnpm check` runs every unit test, 3D included; the pull request gate runs the 3D
   browser suites in Chromium, WebKit and Firefox and the 3D journeys in Chromium and WebKit; the 8 known failures are
   fixed, not skipped (T1, T3, Q1).
2. **One 3D package, `@automata/3d`** (`packages/3d`), holds the renderer, the figures, the world builder, the level
   format and the look, grouped by feature, with tests in `tests/`, and `./sim` as its sim entry. `render-pixi3d`,
   `figures` and `sector-format` are gone (D2, S1 to S3, S9).
3. **No Effect in the 3D package**, its testing entry or base-3d (S4).
4. **Everything from FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52` is in AF**, ported by hand into
   `@automata/3d`'s feature folders. `docs/provenance/sources.md` holds, per builder, the commit read and one row per
   source file (source path, AF path, what was rewritten, or why it was left out), and the pull procedure (section
   7.5), so a later pull is a diff from the recorded commit scoped to those rows (D9, D10, B1 to B10).
5. **The 3D look is the builders' pixel-art look, drawn by Pixi 3D**: a low-resolution render target, light stepped
   along DUEL ramps, outlines and figures lit as sprites, through the game's own camera. No CPU painter
   draws a frame in a game or an editor page; the painters' code survives only as the offline reference the look's
   tests compare with, and as a Node bake if task 8.1 picks baking for figures (section 6).
6. **DUEL is AF's palette** (32 ramps of 8): `@automata/content`'s `DEFAULT_PALETTE`, Emberwick's art, the game UI
   theme (`@automata/framework/theme.css`), the 2D and 3D examples, the 3D swatches and `docs/art/` use it; Endesga 64 is
   gone from the code (section 5).
7. **One animation timeline and one level format.** One keyed-track model (`@automata/3d`'s `timeline` feature) carries
   figure clips, FigureBuilder's scripted actions (as clip content), camera tracks and EnvironmentBuilder's scene state
   (doors, lamps, time of day, props); AF's `evaluate()` plays figures from it and nothing keeps a second player. There
   is one level format, `af-sector/2`, which carries EnvironmentBuilder's world fields and which the game, the editor and
   the world builder all read through one schema (sections 7 and 8).
8. **The base 3D game opens in the editor.** `automata editor games/base-3d` opens its room in Levels 3D and its hero in
   the Studio, Save changes the game's files, `automata check` passes and `pnpm dev` shows the change. A journey proves
   it against the real command on a temporary copy of the game (E1, E2, E3, T2).
9. **One editor app** (D4): `automata editor` opens one suite on the game's folder, holding Levels (2D or 3D, chosen by
   the file), the Studio and the Tuner, listing only what the game has. The standalone 2D and 3D pages are gone.
10. **The 3D editors work on a phone** (D5): drawing, the view switch, the inspector and Save at 390 × 844 and 844 × 390;
    every top-bar action whole and inside the screen, checked by a layout rule for every screen (V1, V5, T5).
11. **The 3D editors look like the approved mock-ups** and use only the kit's tokens: slightly rounded corners
    (`--edge-sm/md/lg`), no pills, the floating icon tool bar, the label-left inspector, the save status (V2, V3).
12. **Every word a person sees passes the drunk grandma test** (section 10): no format ids, paths, plan IDs or source
    project names on screen (C1 to C10, G4 to G6).
13. **The editors keep essential features only** (D6): World, Ask and the change-set desk are gone; every core authoring
    feature stays, including the new ones the builders bring (props, dressing, lamps, time of day, the body sliders).
14. **The site shows 3D beside 2D** (D7): base-3d playable on Home, a 3D group in Examples, "Try the 3D editor", a 3D
    section in the docs and the `@automata/3d` API page, built and tested behind the closed-beta check (W1).
15. **Publishing waits for Pixi 3D** (D1, W2): the release phase (section 11) is written and rehearsed; it runs the day
    `@pixi/3d` is on npm or the Pixi team allows the beta in public. This and the Owner's device and engine runs (D8) are
    the criteria that wait on someone else; every other one is done without them.
16. **No plan IDs or source project names in code and tests**; `pnpm source-names` reads code as well as Markdown;
    every 3D package and the game has a README (S8, section 2 of the audit).
17. **`docs/refactor/progress.md` says 100% for this slice.**

What does *not* change: the sim's laws (the sim stays on Koota, has no I/O, wall clock or `Math.random`, and never
imports Effect); cross-engine determinism of base-3d's golden replay; the vendored `@pixi/3d` 0.1.0-beta.2 and its
launch rule; `automata editor`'s server rules (loopback, token, `Host` check, mtime guard); the kit's document model
(autosave, recovery, history, conflicts); the 2D editor and its `.af2d.json` format, except that the suite holds it
(section 9.1); the target-neutral host contract (ADR 0006).

## 2. Scope

**In, by part (section 12 gives the order):**

- **Part A, the 3D core:** the 3D gates; `packages/render-pixi3d`, `packages/figures`, `packages/sector-format` merged
  into `packages/3d`; `vendor/pixi-3d` (kept as is); the port of both builders; the look; the DUEL palette in
  `@automata/content` and every consumer it breaks (Emberwick, the UI theme, the 2D examples, `docs/art/`). The
  package's map when part A is done:

  ```text
  packages/3d/
    src/entries/    index.ts (.: renderer, camera, look, stage), sim.ts (./sim), level.ts (./level),
                    figures.ts (./figures, with the registries), no-eval.ts, camera-view.ts, testing.ts,
                    photo.ts (./photo, Node only)
    src/app/        the renderer's assembly and the two extensions (render3d, figures)
    src/features/   renderer, camera, look, figures/{body,motion,hair,outfit,figure,lighting,clips,content},
                    timeline, stage, level (sim/ inside), world (library/ inside), photo
    src/shared/     math, rng, parity helpers
    src/testing/    fixtures, golden checks, look-reference/
    tests/          unit/, browser/ (parity, goldens, look), fixtures/
    assets/photos/  the library's photos (not published)
    scripts/        record-goldens.ts, convert-builder-maps.ts
  ```

  `"automata": { "simEntries": ["./sim"] }`; `pnpm boundaries` checks `features/level/sim` and `entries/sim.ts` under the
  sim's rules, `--features packages/3d`, `--forbid` keeps `effect` out of the package and `testing/look-reference` and
  `features/photo` out of every browser entry, and `--platform-imports` keeps `node:` in `photo` only.
- **Part B, the rest of AF that uses 3D:** `games/base-3d`, `examples/3d`, `automata editor`'s policy and its app
  choice, `create-game`'s 3D template, the agent package's 3D parts, `docs/` 3D parts, `tooling/frame-budget`'s 3D probes,
  the `-content` Paraglide compile (T6).
- **Part C, the editors:** `packages/editor-3d` (Levels 3D and the Studio), the one suite page, the suite shell's phone
  layout, `docs/design/editor-3d` (archived).
- **Part D, the site:** `site/`'s 3D pages, and the release phase.

**Out:** Plus; the paid editor apps; the 2D editor's own features (done in slice 2; it only moves into the one suite);
rigged glTF characters (deferred, Owner 2026-10-23); networking; any new 3D feature that neither builder nor the audit
names.

## 3. Owner decisions, as taken

| ID | Taken | What it means here |
|---|---|---|
| D1 | A | Finish 3D now on the vendored beta; publish the 3D package, the 3D editors and the site's 3D pages as the last phase, the day `@pixi/3d` is public. |
| D2 | A | One package `@automata/3d`; `editor-3d` stays its own private package. |
| D3 | A | The source game's blockout and facility formats are deleted; the editor opens `af-sector` files only. |
| D4 | A | One editor app; `create-game` and base-3d get an editor list. |
| D5 | A | Full authoring on a phone. |
| D6 | A | Keep drawing rooms, walls, doors, windows, things and their definitions, Plan, 3D and Walk, the checks, Undo, Save, the Studio's Look, Pose and Animate; cut World, Ask, the change-set desk; the streetwear wardrobe leaves core and an example registers it. |
| D7 | A | The site grows by dimension. |
| D8 | (inputs) | The Owner's: Pixi 3D's release or the Pixi team's written okay, WebKit and Firefox runs on the Mac, playing base-3d and the editors on the iPad. #425's pause is moot: the `3d` workflow stays on (Owner, 2026-11-07 10:36). |
| D9 | A | Port by hand, record each pull in `sources.md`; AF owns its copy. |
| D10 | C, on Pixi 3D | Everything from both builders, the look included, rebuilt on Pixi 3D; DUEL AF-wide. |

## 4. Gates first (T1, T3, T5, T6, Q1)

The gate is fixed before anything moves, so every later phase is measured by it.

- **`pnpm check` runs every unit test.** `check` calls `test:unit` (no dimension filter). `test:unit:2d` stays for a
  quick local loop; `test:unit:3d` stays for the 3D workflow's own job. The 3D unit tests take about 95 s on the
  audit's machine (`editor-3d` 43, `figures` 30, `render-pixi3d` 11, base-3d 9, `sector-format` 2); acceptable on a
  pre-commit hook that already runs 2 to 5 minutes.
- **`3d.yml` stays on** and runs on every pull request that touches `packages/**`, `games/base-3d/**`,
  `examples/3d/**` or `vendor/pixi-3d/**`. Its jobs keep their runners (Q2 is the Owner's queue; the plan does not add
  jobs, and merges the two journey jobs into one so the Mac runs three, not four).
- **#425's timeout fix comes into the stack** (the Owner, 2026-11-07: #425 "now holds only the timeout fix"): the
  `test:browser*` scripts run `--concurrency=2` with `--hookTimeout=90000`, and `gate-scripts.test.ts` holds it. If #425
  has not merged by then, it is closed as carried (its branch is the Owner's to delete).
- **The 8 failures** are fixed in the product and the test:
  - *Seven, `open-flows.layout`:* the kit's `Dialog` already owns the dialog's scroll region; `ErrorPanel` inside it
    stops declaring a second one when it is inside a dialog (one scroll region per dialog, the responsive rule), and the
    test reads the problem list by its role and name, not "the first `[data-scroll-region]`".
  - *One, the Pencil journey at iPad mini landscape:* at that size the inspector is a sheet and the floating tool bar
    sits over the plan. The plan's usable area is the stage minus the sheet and the tool bar (from the kit's geometry
    owner, not a local measure), and "fit to room" frames the room inside it, so a tap the journey makes lands on the
    plan. The test asks the page for the usable area instead of using fixed corners.
- **Journeys in Chromium too.** The 3D editor's journeys run in Chromium and WebKit (`journey-project.ts` lists both);
  a cloud session can run them.
- **Every action whole and inside.** A layout rule in the framework's layout contract (`checkLayout`): every element
  with a role of button, link, tab or menuitem in a top bar, dock or tool bar is fully inside the viewport and not
  covered by another element at its centre. Every editor layout test calls it at every size it runs. It fails on the
  Studio's clipped Publish today (T5), and on the phone level view's missing tools once the tools are required (V1).
- **Paraglide without an empty folder (T6).** `-content`'s `compileInFolder` compiles into a temporary folder, then copies
  over only files whose bytes changed and deletes files that are gone; the output folder is never empty, and an
  unchanged compile writes nothing.

## 5. One palette: DUEL (D10)

- **Owner:** `@automata/content`'s `palette` entry stays the one owner of the palette. `shared/palette/endesga-64.ts`
  is replaced by `shared/palette/duel.ts`, the 32 × 8 ramps copied from FigureBuilder's `src/features/paint/duel-ramps.ts`
  at `025ffb4` (provenance recorded). `DEFAULT_PALETTE` becomes DUEL's 256 colours, row-major, ramp `r` step `s` at index
  `r * 8 + s`, and the palette entry gains `ramps` (the 32 rows) and `rampOf(index)` / `step(index, by)` so the look and
  the 2D art both move colour "the DUEL way" (along a ramp in whole steps).
- **Consumers moved in the same change** (a palette change moves content hashes everywhere, so it is one PR):
  `build-atlases.ts`; Emberwick's `shared/art/palette.ts`, its sprites, backdrop, particles and lights (each Endesga
  index mapped to the nearest DUEL colour in OKLab, then checked by eye against the before screenshots, with hand
  fixes recorded in `shared/art/PROVENANCE.md`); `packages/automata/src/shared/ui/theme.css` (each UI colour mapped to
  the nearest DUEL colour that keeps the theme's contrast pairs at their current ratios, checked by `theme.test.ts`);
  the 2D examples; `docs/art/` (DUEL's source and credit, as Endesga 64's were); the agent package's API reference.
- **Not the editors' and the site's chrome.** The editor kit's `tokens.css` (which the site imports) is the look the
  Owner approved on 2026-11-06 (the redesign mock-ups: neutral greys, one lime primary). It is product chrome, not game
  art, so it keeps its colours (veto default 11). What the editors draw *of a game* (the 2D level canvas's layer
  colours, the 3D plan's room fills, swatch pickers) is game art and uses DUEL.
- **Hashes:** content hashes and goldens that depend on colour change once, in that PR, whose description lists each
  one and why. The sim hash does not change (the palette is not sim content); if it does, that is investigated, not
  rebaselined.
- **Visual acceptance:** before/after screenshots of Emberwick and the editor at phone, iPad and desktop; recorded under
  the standing visual rule once a reviewer has opened them.

## 6. The look on Pixi 3D (D10, B4, B8)

The builders paint on the CPU: a G-buffer per figure or scene, light per vertex stepped along DUEL ramps, outlines,
dither and grade, at 320 × 200. AF draws the same look with Pixi 3D:

- **Measured first, then chosen** (plan phase 8, task 8.1). Two candidates on base-3d's room with Wick: (a) *passes*:
  Pixi 3D renders into a low-resolution target (the view's pixel size, 320 × 180 at 16:9 by default), materials quantise
  light into ramp steps, a post filter snaps each pixel to its DUEL ramp and draws outlines from depth and normal
  edges, and the target is drawn to the screen with nearest-neighbour scaling; (b) *bake*: the painters bake sprite
  cells and textures offline, and Pixi 3D draws billboards and textured meshes. **Rule:** choose (a) if it holds the
  frame budget (section 6, last bullet) on the GPU runner's phone profile with the free camera turning; else (a) for the
  world and (b) for figures only. The measurement and the choice are recorded in `docs/adr/0007-3d-look.md`.
- **The passes live in `packages/3d/src/features/look/`**: `look.ts` (the settings a view takes: pixel size, ramp steps,
  outline, dither, grade, from EnvironmentBuilder's `paint/library/look.json`), `ramp-light.material.ts`,
  `duel-snap.filter.ts` and `outline.filter.ts`, each filter a GLSL + WGSL pair taking pixel position from the vertex
  stage (AGENTS.md), WebGL2 at parity with WebGPU, and `sprite-light.ts` (figures lit as one flat sprite, EnvironmentBuilder
  `stage/sprite-light.ts`).
- **Times of day** (`world/library/times.json`, `paint/library/times.json`) set the look's light and grade; a level names
  one (section 8).
- **The reference:** both painters (FigureBuilder `paint/{paint,raster,fabric}.ts`, `lighting/`; EnvironmentBuilder
  `paint/`, `view/render.ts` and `view/fp.ts`) port to `packages/3d/src/testing/look-reference/` as plain TypeScript
  with no browser or Node globals. They are the oracle for the look's tests (a scene painted by the reference and drawn
  by Pixi 3D agree within a palette-index tolerance the test names) and, only if task 8.1 picks baking for figures, the
  body of a Node bake entry. A `--forbid` boundary rule keeps them out of every browser entry, so no game or editor page
  paints on the CPU. The Studio's figure thumbnails are drawn by Pixi 3D into a small render texture.
- **Views belong to the editor, not the core** (the Owner, 2026-11-07 11:04: "the diorama, first-person and top-down
  views sounds more like they should be in the editor and not 3D"). The 3D core keeps one camera, the game's (the Crow
  Country camera: 24 mm, 25° down, 5 m back, turned freely), and the look draws through whatever camera it is given.
  EnvironmentBuilder's diorama, first-person and top-down views (`view/`) become Levels 3D's views in `editor-3d`
  (section 9.3): top-down is the Plan, the diorama is the 3D view, first person is Walk. Their framing math
  (`view-frame.ts`, `readability.ts`: framing a map, and how a figure reads against its room) ports there too. The CPU
  `view/render.ts` and `view/fp.ts` are not ported as runtimes (they go to the reference). `view/shots.ts` (shots and
  sequences on one clock) goes to the core's `stage` feature (section 7.4), since a game plays it.
- **Frame budget:** 30 fps (33 ms) at the phone profile and 60 fps (16.7 ms) at the iPad profile, measured by
  `tooling/frame-budget`'s 3D probe of the game's camera with every pass on, on the GPU runner with
  exclusive access. A software renderer skips the budget (as the 2D probes do) and says so. Real-device numbers are the
  Owner's (D8). The hero's first pose budget (5 ms, G7) is measured in the same probe and either met or changed to a
  measured number with the reason in the spec's veto defaults.

## 7. Figures, the timeline, the stage and provenance (B1 to B5, B9, B10)

### 7.1 Where the figures go

`packages/3d/src/features/figures/` takes FigureBuilder's feature folders as they are: `body/` (genes, head, parts,
rig), `motion/` (motion, presets, the natural stand, seats), `hair/` (pieces, the low pony, bun, fall, curl volume),
`outfit/` (garments, items, fit from the body's rings and girth), `figure/` (cast, cloth, frames, figure), `lighting/`
(grade, lamps, light). AF's current `figures` code (build, clip, evaluate, garments, genes, hair, library, math, motion,
parts, pose, rig, solve, content) moves straight into those folders in phase 2 (one move, not two), so the port in
phase 6 lands file beside file. Where both have a version, FigureBuilder's newer one wins unless AF's has a behaviour
AF's goldens or games rely on, and that choice is written in the file's `sources.md` row.

### 7.2 Meshes and texels

The generator builds meshes Pixi 3D draws (AF's way) and the look (section 6) gives them the builders' surface:
fabrics are tone-label tiles sampled as a texture, the face's marks (eyes, lips on a two-row chin, brows) are a small
texture on the head made from the painter's own rules, so eye size, spacing and tilt read as they do in the source
(B4).

### 7.3 The wardrobe

The five registries (`registerGarment`, `registerOutfitHooks`, `registerHairPiece`, `registerFinish`,
`registerFabric`) come in as the extension seam, called from a `defineExtension` (core never imports an extension).
Base holds no wardrobe. AF's `streetwear/` moves to `examples/3d/wardrobe/`, which registers it; the `figure-headwear`
content kind moves with it (D6, B2). Wick's cap is the one headwear a core game wears: base-3d registers it through its
own small extension, not by importing the example.

### 7.4 One timeline, one stage (B5)

Three keyed-time models exist today: AF's clips (`clip/ease.ts`, `sample.ts`, `clip-time.ts`, played by
`evaluate()`), FigureBuilder's actors (`actors/`: an action set on a script that is a pure function of time) and
EnvironmentBuilder's tracks (`world/timeline.ts`: keys `{ t, v, ease }` shared by the camera and the scene state,
`stage/state.ts`, `view/shots.ts`). They become one:

- **`features/timeline/`** owns the key, the eases and sampling, from AF's clip code (the one with tests and a content
  schema), widened by EnvironmentBuilder's eases (`smooth`; its `hold` is AF's `step`). A track is a sorted list of keys
  of one value type; sampling is pure and needs no clock (a frame at `t` is the same whether drawn first or alone).
- **Figures:** a clip is a set of tracks over poses, as now; `evaluate()` is the only figure player. FigureBuilder's
  action set (`actions.json`, `actions.ts`, `pose-spec.ts`) becomes a `figure-action` content kind (Zod,
  `*.content.ts`) whose entries compile to clips, so an action is authored in the Studio's Animate like any clip.
  `actor.ts`'s script (cues on waypoints) becomes stage content (below), not a second player.
- **The stage** (`features/stage/`: EnvironmentBuilder `stage/{actor,cast,camera,runtime,state}.ts` and `view/shots.ts`,
  FigureBuilder `actors/actor.ts`'s script): a presentation director. Its script is content (`stage-script`, Zod) of
  tracks for the camera, doors, lamps, time of day, grade and props, and cues that start figure clips. It reads time
  from the presentation's interpolated tick time, never a wall clock, and holds no gameplay state (law 1): the sim's
  events start a script, the stage only draws. `runtime.ts`'s "change only what changed" becomes the renderer's update
  of the world's pieces.

### 7.5 Where it came from, and pulling again (B9, B10)

- `docs/provenance/sources.md` gets two sections, "The figure source" and "The environment source" (the file's neutral
  names; the repository names appear only there). Each holds the repository, the commit read (`025ffb4…`, `6d82a52…`
  in full), the licence fact (none recorded: the Owner's private repositories), and one row per source file: source
  path, AF path, *ported* / *rewritten* (what changed) / *left out* (why). Library JSON files and EnvironmentBuilder's
  photos get rows too, with the photos' Poly Haven CC0 credits kept in the ported `photos.json`.
- **Left out on purpose:** EnvironmentBuilder's `vendor/FigureBuilder` submodule (AF ports FigureBuilder itself, three
  cycles newer; EnvironmentBuilder's door file `lib/figure.ts` becomes an import of AF's `figures`), its
  `docs/reference/` (copies of a source game's files), both repositories' `docs/superpowers/` and review tooling.
- **Pulling again** is a planned task, written in `sources.md` as a procedure: clone the builder, `git diff
  <recorded>..<new> -- <the rows' source paths>`, port each hunk to its AF row (tests first), list new source files as
  new rows, record the new commit. `tooling/repo-hygiene`'s `source-names` learns EnvironmentBuilder's name
  (FigureBuilder's is there) and reads code as well as Markdown, so nothing outside `docs/` records names a source.

## 8. One level format: `af-sector/2` (B6, B7, K2)

- **Owner:** `packages/3d/src/features/level/` (the former `sector-format`), exported as `@automata/3d/level` and, for
  the sim's part, through `@automata/3d/sim` (declared in `"automata": { "simEntries": ["./sim"] }`).
- **What `/2` adds to `/1`,** from EnvironmentBuilder's `world/types.ts` (`MapPlan`, `Sector`, `MapWall`, `Plane`,
  `Decor`, `Dress`, `Lamp`, `TimeOfDay`, `WindowGrid`): sloped floors and ceilings and open sky (`floor` and `ceil`
  become planes: `{ z, slope?, sky?, surface? }`, a plain number still read as `{ z }`); wall `decor` (dado, rail,
  cornice, windows, shopfronts, signs), window grids; `dress` (`{ as: "office" }` from a kit, each placed piece with an
  id an edit can name); `props` placed by id; `lamps`; `time` (a time of day by name); `views` (named camera views,
  so base-3d's `ROOM_VIEWS` moves out of code, K2/EG-4); `decals` and `lettering`; entity definitions with fields
  instead of bare ids (EG-2); pits as a sector flag, not "floor below 0" (EG-3); non-box rooms (EG-5: the game reads
  `corners`, not bounding boxes). AF keeps its `corners` that carry their walls and its `holes`. EnvironmentBuilder's
  `verts`/`rect` and walls by edge index are not a second input: its library maps (`maps.json`, the base scenes) are
  converted once, at port time, by `packages/3d/scripts/convert-builder-maps.ts` into `/2` files under
  `features/world/library/maps/`, and the generators are rewritten to emit `/2` directly. No runtime code reads the
  builder's map shape.
- **Migration:** `level/af-sector-1-to-2.migration.ts` reads a `/1` file and writes `/2`; the editor opens a `/1` file,
  says "This level was made with an older version. Saving updates it.", and writes `/2` on Save. base-3d's room is
  migrated in the same PR.
- **The world builder** (`packages/3d/src/features/world/`: build, sectors, mesh, subdivide, surface, swatches, props,
  dress, decals, lettering, generate, and `library/` with `kits.json`, `props.json`, `swatches.json`, `glyphs.json` and
  the converted maps) turns an `af-sector/2` level into meshes Pixi 3D draws. It is renderer-free and pure; its
  generated maps (`apartment@<seed>`, `block@<seed>`) take a seed from the level through AF's seeded rng, never
  `Math.random` (it is outside the sim but stays deterministic so the editor and the game build the same room). The
  library files are content kinds with Zod schemas (`world-kit`, `world-prop`, `world-swatch`), so a game adds its own
  kits and props as content, and the editor's "Furnish as" lists what the game's content holds.
- **Surfaces and photos:** a swatch names a DUEL ramp and step, or a texture. The photo pipeline (EnvironmentBuilder
  `photo/`, `lib/png.ts`) is a Node-only entry, `@automata/3d/photo`, run by `automata textures`; it turns photos into
  small DUEL-indexed tiles. The library's photos (Poly Haven CC0, 2.9 MB, credited in `photos.json`) come in under
  `packages/3d/assets/photos/`, outside the package's published `files`; the tiles made from them are committed as
  generated content beside the library (stamped with the photo's hash, so `automata check` says when one is stale),
  so a game gets textured kits without running the tool.
- **The game-facing meaning** of a level (K2): what the sim reads (sectors' floors, walls, pits, things and their
  fields, spawn) is `level/sim/`, under the sim's boundaries; dressing, lamps, decals, time and views are presentation
  only and live outside it.

## 9. The editors

### 9.1 One suite (D4, E2 to E5)

- `automata editor [folder]` opens one page, the suite, on the game's folder. It lists what the game's
  `content/editors.toml` names: Levels for `*.af2d.json` (the 2D editor) and `*.af-sector.json` (Levels 3D), the Studio
  for `content/figures/*.toml`, the Tuner for `tuning.toml`. Without a list, the policy reads level files of both kinds.
- **The page:** `packages/editor` keeps the 2D-only suite page (it may not import 3D, by its `--forbid` rule).
  `packages/editor-3d` builds the full suite page from the editor's suite plus Levels 3D and the Studio. The command
  serves the full page when the game has a 3D file and the 3D build is present, else the 2D page; `--app` and the
  standalone 2D and 3D editor pages go (`editor-command.ts` `BUILDS`, `packages/editor-3d/src/main.ts`,
  `packages/editor/src/app/editor-2d/`). A published `-tools` packs only the 2D page until the release phase (the
  closed-beta scan).
- **The suite opens the checkout** (`openSuitePorts`, as the 2D page does); the sample game is the site's try-it page
  only, and gains a 3D room and Wick so "Try the 3D editor" has something to edit.
- **The change-set desk goes** (Review, Export changes, Import changes, Publish over a sample) and Ask and World go (D6,
  E6); the `@automata/editor-3d` root and `./suite` entries go (E5).

### 9.2 Inside `editor-3d`

- **Feature folders** like `packages/editor`: `app/` (the suite page), `entries/`, `features/` (`levels-3d/` with
  `plan/`, `walk/`, `dollhouse/`, `inspector/`, `things/`, `definitions/`, `checks/`, `document/`, `home/`;
  `studio/` with `look/`, `pose/`, `animate/`, `stage/`), `shared/` (geometry, edit commands, the level session) and
  `testing/`; tests in `tests/{unit,dom,browser/{layout,canvas},journeys}` with `#src/…` imports. `pnpm boundaries
  --features`, `style --test-imports` and `--plan-comments` cover it.
- **The source game's format goes (D3):** `format/`, `profile/last-light-*`, `checks/facility/`, `checks/last-light/`,
  `model/facility-*`, `testing/toy-blockout.ts`, `testing/shipped-facility.ts`, and the `blockout` entry. One profile,
  `af-sector`, stays, so `profile/registry.ts` becomes a plain import.
- **`suite-content-shim.ts`** imports `@automata/content/schema` and `/palette` (K3).
- **Tokens:** only the kit's (`tokens.css`); the 14 missing tokens are replaced by their kit names, and every
  `--radius*`/`--pill` becomes `--edge-sm/md/lg` (V3). A style rule fails on a `var(--…)` the kit does not define.

### 9.3 The redesign (V1, V2, V4, V5, D5)

From `refactor/2026-11-06-redesign-mockups/editor-level.html` and the visual direction, phone first:

- **Levels 3D's views** are the builders' three (section 6): Plan is the top-down view, 3D the diorama, Walk first
  person, each drawn by Pixi 3D in the game's look, framed by the ported framing math, and the Walk view says when a
  character does not read against the room ("Wick is hard to see here"). They live in
  `features/levels-3d/views/{plan,diorama,walk}/` and their frame budget is checked by the editor's own probe.
- **Levels 3D:** the top bar is Back, the game and level menu, the views (Plan, 3D, Walk) as quiet tabs (a menu on a
  phone), Undo, Redo, problems, the save status and one lime primary (Save); tools float top centre as icons with
  names on hover and in an accessible name (Select, Room, Corner, Doorway, Door, Window, Thing, Prop, Lamp); the
  inspector is label-left and shows the level with nothing chosen; three layouts by the container (wide, medium,
  compact), with the tools in a dock and the inspector and layers in sheets on compact; Fit stays; layer rows have one
  eye and one lock icon, no emoji (C8).
- **New authoring from the builders** (core authoring, so in): dress a room from a kit (a "Furnish as" field on a room:
  Office, Apartment, Shop…, from `kits.json`), place and move props, place lamps, pick the level's time of day, add a
  wall's trim and windows; each is one inspector field or one tool, nothing more.
- **The Studio:** the same top bar; on a phone Undo and Redo go into the menu, the panel toggles become one Panels
  button, Dock goes, and Publish becomes Save (the game's files); the stage on top, the timeline a bottom sheet. Look,
  Pose and Animate; Look gains the new body sliders (fat, bust, seat, asymmetry), the face's sliders and the new hair
  pieces; Animate plays and edits actions as clips.
- **Home:** the kit's redesigned Home ("What do you want to change?"), files named in words, no "Sources" button.
- **The suite on a phone (V4):** the top bar names the game; the bottom bar lists only the editors the game has (Levels,
  Characters, Tuner: one "Levels" whether the level is 2D or 3D, since the file decides), and Home lists every file of
  every editor; in phone landscape the bar folds into the top bar's menu so the stage keeps the height.
- **The look:** the approved mock-ups and `taste-skill`'s standard: slightly rounded corners from `--edge-sm/md/lg`,
  never a pill or a fully rounded button, hairlines, one lime primary per screen, icons from the kit (Lucide-drawn).
- **Mock-ups:** `docs/design/editor-3d` moves to `docs/archive/design/editor-3d` (S10).

### 9.4 Real journeys (T2)

Playwright journeys under `packages/editor-3d/tests/journeys/` that start the real `automata editor` on a temporary
copy of base-3d (an isolated port and folder per run): open the room, draw a room, furnish it, save, the file on disk
changes, `automata check` passes, the game's dev server shows the new room; open Wick in the Studio, change a slider,
save, the figure file changes and the game shows it; and on a phone (390 × 844, touch) draw a room with the dock's tools
and save. Chromium and WebKit; one phone and one iPad size each.

## 10. Copy (the drunk grandma test)

Every string a task changes goes in `docs/refactor/copy.md` (a new "3D editors" and "Base 3D" section), old and new,
and passes the core spec's four questions; the build audit reads every 3D screen with the drunk grandma test (could a
drunk grandma tell what is happening and how to use it?). The fixed calls:

| Today | New |
|---|---|
| "Read as af-sector. This editor opens af-sector and last-light-blockout." | (gone; the file just opens) |
| "sectors.0.floor Invalid input: expected number, received string" ×40 | "Room 1's floor height isn't a number. Open the room and type a number." (one line per problem, grouped by room, with a Show button) |
| "This is a sample game, not yours…" in a game folder | (gone: the suite opens the folder) |
| "No projects yet. Import a folder or a zip to start." | "This game has nothing to edit yet." with the one action in sight |
| Sector, Vertex, Portal, Definitions…, spawn, "51 px per metre", "af-sector" | Room, Corner, Doorway, Thing types…, Start point, (scale hidden), (badge gone) |
| "Nothing to edit in Studio yet." | "This game has no characters yet." with New character |
| "Opened Base 3d in the level editor." | "Opened Ember Hall." (the game's title from its config) |
| Studio (the tab and the editor's name) | Characters (what a grandma calls what she edits there; the code's folder stays `studio/`) |
| New in this slice: "Furnish as", "Time of day", "Lamp", "Prop", "Trim" | Furnish as (Office, Bedroom, Shop…, the kit's own name), Time of day (Morning, Dusk, Night…), Lamp, Furniture and things, Wall trim |
| Studio: `wick`, `guard-high`, Skin `wick-shadow`, Gait `bounce`, sliders 0.4, Playhead, Add key, Dock | Wick, High guard, Skin "Shadow", Walk "Bouncy", sliders with words at each end ("Thin" … "Heavy"), Time, Add a pose here, (Dock gone) |
| HUD "● 0", pause "II", no Settings in the menu | "Embers 0 of 6", a pause icon named Pause, Settings on the title menu |

The game is called **Ember Hall** everywhere (its title screen's name; G4): the folder stays `games/base-3d`, the CLI
and the editor show the game's title, and `DESIGN.md` drops "Emberwick in 3D".

## 11. The site and the release (D1, D7, W1, W2)

- **Built now, behind the beta check:** Home shows Ember Hall playable beside Emberwick; Examples has a 3D group (the 3D
  examples, `examples.ts` no longer keeps them out); the Editor page has "Try the 3D editor" (the suite's sample with a
  3D room and Wick); the docs gain a 3D section (making a 3D game, the level, figures, the look); the API page covers
  `@automata/3d`. The site build has a `3d` switch (`AF_SITE_3D=1`): off, the site has no 3D page and no `@pixi/3d` byte
  (the scan proves it); on, it builds the 3D pages for the site's own tests and for the release rehearsal. The deployed
  site keeps it off until the release.
- **The release phase** (one PR, written and rehearsed now, merged on the day): replace the vendored tarball with the npm
  `@pixi/3d`, delete `vendor/pixi-3d`, make `@automata/3d` public at the stack's version, pack the full suite into
  `-tools`, lift the closed-beta refusals in `ship prepare` and the scan, publish `create-game`'s 3D template, deploy the
  site with `AF_SITE_3D=1`. Its trigger is the Owner's (D8): `@pixi/3d` on npm, or the Pixi team's written okay.
- **Versions:** the first release is 0.1.0 (the Owner, 2026-11-07), made by the 2D slice's task 14.2. `@automata/3d`
  joins the published line later at the line's current version with a `patch` changeset (the 2D slice's patch-only rule
  before 1.0); it never gets a version of its own.

## 12. Order and pull requests

Each phase is one PR stacked on the one before (the first on this spec's branch), opened ready, not draft. Parts in the
Owner's order; a part's last PR merges before the next part's first is opened for review.

| Part | Phases | What |
|---|---|---|
| A. The 3D core | 1 to 10 | Gates; one package; Effect out; cuts; DUEL; FigureBuilder; one level format and the world; the look; the photo tool; words and provenance |
| B. The rest of AF that uses 3D | 11 to 13 | Ember Hall (base-3d); the examples and `create-game`; the command, docs, agents and probes |
| C. The editors | 14 to 18 | `editor-3d` by feature; one suite; Levels 3D redesign; Studio redesign; copy and real journeys |
| D. The site | 19, 20 | The site's 3D pages; the release |

Phase 1 also fixes the 8 editor tests (they gate everything), which is the only editor work before part C.

Execution is native and inline in each session, with no subagents ever (no Task-tool delegation, no subagent-driven
execution, no workflows). The later stages run as their own threads: the plan audit (Opus, medium), the build (Sonnet,
high), the build audit (Opus, medium) and the fixes (Sonnet, high), each handing off after 90 minutes.

## 13. If the Owner chooses differently

- **D1 B (stop until Pixi 3D is public):** phases 1 to 5 still run (gates, the package, Effect, cuts, DUEL, which is
  2D too); the rest waits.
- **D2 B (three packages):** phase 2 restructures inside each package instead of merging; every later path changes
  from `packages/3d/src/features/<x>` to the package of that feature.
- **D3 B (keep the source format as an extension):** phase 4 moves `format/`, the last-light profile and checks into
  `examples/3d/blockout-profile/` registered through `defineExtension`, renamed so no source name remains.
- **D4 B (four pages):** phase 15 wires each page to the checkout instead of deleting three.
- **D5 B (phone views only):** phase 16 gives the phone the view switch, Walk and the inspector, and a line "Drawing
  works on an iPad or a computer."
- **D6 B (keep all that is built):** World and Ask stay, each with copy that says what they do today.
- **D7 B (one 3D page):** phase 19 builds one `/3d` page instead of the per-page groups.

## 14. Risks

| Risk | What the plan does |
|---|---|
| Pixi 3D's beta cannot take a custom material (ramp light) | Task 8.1 checks first; the fallback is quantising light in the post filter from a lit buffer, which needs no custom material. |
| The look misses the frame budget on a phone | Task 8.1's rule: bake figures (section 6); the world's passes can drop dither and outline width at the phone profile. |
| The port grows the 3D package past the 600-line file rule | Files split by responsibility as they land; `style` fails otherwise. |
| DUEL breaks Emberwick's art | Nearest-in-OKLab mapping plus hand fixes, before/after screens, `art.test.ts`. |
| `/1` levels in the wild | The migration, and the editor's "Saving updates it" line. |
| The Mac's CI queue | No new jobs; the two 3D journey jobs merge into one. |
| Pixi 3D stays private for long | Everything but phase 20 is done and merged; the site ships 2D. |
| The builders keep moving during the slice | The port reads only the recorded commits; a later commit is a planned pull (section 7.5) after this slice, not a moving target inside it. |
| Three keyed-time models do not fit one key | Task 6.4 writes the timeline's tests from all three sources' cases first; a value type a track cannot carry (a door's swing, a lamp's light style) is a typed track, not a second model. |
| The world builder replaces the room mesher and moves base-3d's picture | The sim reads the same `level/sim` values (golden replay unchanged); the picture's change is explained with expected, actual and diff images in the PR. |

## 15. Veto defaults (decided here; the plan audit or the Owner may change them)

1. The package folder is `packages/3d`, its name `@automata/3d`.
2. The game's name is Ember Hall.
3. The look's default pixel size is 320 × 180 at 16:9 (EnvironmentBuilder's 320 × 200 at its 16:10).
4. The frame budget is 30 fps on the phone profile and 60 on the iPad profile.
5. `pnpm check` runs every unit test.
6. `/1` levels are migrated on open and written as `/2` on Save, never silently on open.
7. The streetwear wardrobe lives in `examples/3d/wardrobe/`.
8. The painters' code is kept as the look's offline reference (`testing/look-reference/`: the look's tests, and a Node
   bake only if task 8.1 picks baking for figures), not deleted and never in a browser entry.
9. The photo pipeline is a Node entry `@automata/3d/photo` run by `automata textures <photos> --out <folder>`; the
   library's photos come in under `packages/3d/assets/photos/` (not published) with their CC0 credits, and the tiles
   made from them are committed generated content.
10. Ask, World and the change-set desk are deleted, not hidden.
11. DUEL covers game art and the game UI theme; the editors' and the site's chrome (`tokens.css`) keep the approved
    2026-11-06 colours. If the Owner meant the chrome too, task 5.2 maps `tokens.css` the same way the theme is mapped.
12. The Studio is called Characters on screen.
13. The 3D package's figure, level and world libraries are content kinds (Zod), so games extend them as content, not code.

## 16. The code standard

As the 2D slice's section 17: minimal, elegant, well documented, not over-engineered; small files with one
responsibility; descriptive names; comments that explain invariants and failure policies, never plan IDs or source
projects. Ported code is rewritten to AF's conventions as it lands (role suffixes, Zod content kinds, no Node globals
outside Node entries, `@automata/3d/sim` under the sim's boundaries), not copied and tidied later.
