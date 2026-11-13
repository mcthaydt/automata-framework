# The example set: survey (2026-11-13)

For the plan [`../plans/2026-11-13-one-example-set.md`](../plans/2026-11-13-one-example-set.md) and the spec
[`../specs/2026-11-13-one-example-set-design.md`](../specs/2026-11-13-one-example-set-design.md). Branch
`claude/example-set-plan`, from `claude/coordinator-notes` at `78a4784b3` (`main` plus the specs). Read-only: no product
file is changed. The old examples were read for what they cover and how they are wired, never for how they look.

Branches read (`git fetch origin <branch>`; commits ahead of `main` by `git rev-list --count origin/main..origin/<branch>`):

| Branch | Tip | Ahead of `main` |
|---|---|---|
| `claude/ship-3d-plan-audit` | `e0489de76` | 11 |
| `claude/editors-v2-landing-plan-audit` | `b9892a256` | 4 |
| `claude/last-light-camera` | `321f9d37a` | 187 |
| `claude/last-light-ada` | `d3a02096f` | 200 |
| `claude/3d-night-regression` | `f1bc65d66` | 3 |
| `claude/scope-rename` | `673db5e99` | 5 |
| `claude/last-light-editors-stress` | `cbbfa437a` | 179 |

## 1. What 3D can do that an example should show

From each package's `package.json` `exports` and README on `main` (one `node -e` over the manifests), and the camera and
figure fields on the game's branches. "Data" names the editor that owns the file; "code" means the game writes it.

| # | Capability | Entry a game imports | Data or code |
|---|---|---|---|
| 1 | A level as a file: rooms, walls, doors, masses, props, lamps, cast places, views | `@automata/3d`, `@automata/3d/level` (`af-sector/2`) | Data: Levels 3D |
| 2 | The gameplay camera: follow, tilt, distance, `lensMm`, `focusBounds`, `lead`, `peekReach`, `yawDeg`, `rotate`, cut-away walls, the occluder rule | `@automata/3d`, `@automata/3d/camera-view` (`camera-view` kind, and a level's `views`) | Data: Levels 3D keeps a view's fields but has no form for them (stress row 7) |
| 3 | The pixel-art look: a low-resolution field, DUEL colours, stepped light, an outline; `targetSize`, `addLookPass` | `@automata/3d` | Code (a few lines); look numbers in `content/look.toml` have no editor (stress row 15) |
| 4 | Lamps, baked light, the sun, fog and haze, a time of day (`day`, `golden`, `dusk`, `night`, `lampLit`, `bar`) | `@automata/3d` (the level's `lamps`, `time`, `look`) | Data: Levels 3D |
| 5 | Sky passes: stars, rain, glow, reflections, shafts, particles | `@automata/world-kit/sky` (`addSkyPasses`) | Code (one call); the level's `sky` (horizon, layers) is data |
| 6 | Props as data: 95 presets, generators with parameters, a room furnished from one word (8 purposes), generated maps | `@automata/world-kit` (`worldKitExtension`, `dressLevel`, `generateMap`); `@automata/3d/props-kit` to add a shape | Data: `world-props`, `world-swatches`, `world-kits`; Levels 3D |
| 7 | Photo surfaces: 38 CC0 photos to DUEL tiles, checked by sha-256; `checkReads`, `readsAgainst` | `@automata/world-kit`, `@automata/world-kit/textures` | Data (swatches) and a command (`automata-world-textures`) |
| 8 | The LCD screen look | `@automata/lcd-panel`, `/pass` | Code (one call) with a settings profile |
| 9 | The retro grade, fade, dither and the crisp whole-pixel upscale | `@automata/retro-crisp`, `/pass` | Code (one call) with a settings profile |
| 10 | Procedural figures: body sliders, gaits, stands and poses, clips and actions, aim, items | `@automata/3d/figures`, `@automata/3d/base` | Data: Characters (`figures`, `figure-*` kinds) |
| 11 | Painted figures at density 2, lit by their room, depth per texel; `grid`, `dimmest`, `holdSkinHue` | `@automata/character-kit` (`paintedFigure`) | **Code today** (a `CharacterDef` in TypeScript); no content kind, Characters cannot open one (stress row 3) |
| 12 | Clothes, fabrics, headwear, hair pieces and finishes, seats | `@automata/character-kit` (`characterKitExtension`, `registerFashion`) | Data inside a character; `figure-seats`, `figure-hair`, `figure-headwear` kinds |
| 13 | Rooms the sim knows: which room a thing is in, enter and cross events, walls to walk against | `@automata/sectors`, `/sim`, `/physics` (uses `@automata/physics/3d`) | Data: the level |
| 14 | Finding the way: click to walk, routes on a graph | `@automata/nav`, `/sim` | Data: `nav/*.toml`, Schematic |
| 15 | Using a thing: tap it, walk there, use it | `@automata/interact`, `/sim` | Data: the level's hotspots (`entityDefs`); **private, and stays private in the 3D lane's plan** |
| 16 | Puzzles: verbs, facts, a solver that proves there is no dead end | `@automata/puzzle`, `/sim`, `/solver` (public, 0.0.5) | Data: `puzzles/*.toml`, Schematic |
| 17 | Rules and creatures: patrol, sight, hearing, chase; bots that play | `@automata/systems`, `/sim`, `/bots` | Data: `systems/*.toml`, Schematic |
| 18 | Conversation and story: lines, choices, storylets, the dead-end check | `@automata/narrative`, `/content`, `/sim` | Data: `lines/*.toml` in Writer; storylets and beats have no editor (stress row 12) |
| 19 | Cutscenes: keyed tracks, a director, a 3D stage | `@automata/cutscenes`, `/content`, `/director`, `/stage-3d` | Data: `cutscenes/*.toml`, Sequence |
| 20 | The play screen: what to do next, what can be used, what is carried | `@automata/hud`, `/content` | Data: `hud/*.toml`, no editor (stress row 16); **private, stays private** |
| 21 | Sound made from numbers | `@automata/audio-synth` (public) | Data: `audio/*.toml`, Audio (synth voices; recorded files read as silent, stress row 4) |
| 22 | Feel: shake, flash, hit-stop | `@automata/feel`, `/stage` (public) | Data: `feel/*.toml`, Feel |
| 23 | Saving, languages, input, host | `@automata/framework` | Code (core); tuning numbers in Tuner |

Not for the 3D set: `@automata/net*` (no 3D consumer; the 2D set's), `@automata/physics/3d` on its own (shown through
`sectors`), `@automata/debug` (a tool, not a feature), `level-2d`, `pipelines`.

## 2. What there is to build the place and the cast from

**The place.** World kit on `main` (`node -e` over `extensions/world-kit/library/*.json` and `assets/photos/photos.json`):
95 prop presets, 8 room purposes, 170 swatches, 38 photos. The game's branches change 9 world-kit files each, so the kit is
close to `main`'s. The level file (`packages/3d/src/shared/level/af-sector-2.schema.ts`) holds `sectors` (floor,
ceiling, light, zone, door, dress, view, textures, trim), `masses`, `props` (`use`, `kind`, `model`, `fit`, `with`),
`cast` (`who`, `pose`, `at`), `lamps` (kind, colour, range, level, cone, flicker, shaft, flame), `time`, `sky`
(horizon, layers), `views`, `paths`, `decals`, `lettering`, `entityDefs` and `entities` (hotspots).

What a station needs, and where it comes from:

| Thing | Have (preset or kind) | Missing: what making it takes |
|---|---|---|
| Brick, plaster, panelling, boards, paving, kerb, roof, enamel, metal | swatches `brickRed`, `brickFlemish`, `plasterPaint`, `panelPainted`, `pineFloor`, `pavingSlabs`, `kerbStone`, `roofShingles`, `enamel`, `steelGrey` | nothing |
| Track ballast, sleepers | none | two CC0 photos (`ballast`, `sleeper`), each a row in `photos.json` with source, licence and credit, a swatch, and its tile from `pnpm --filter @automata/world-kit textures` |
| Rails on sleepers | none | a generator `rails` (`length`, `gauge`) registered with `registerPropGenerator` |
| Platform edge (coping, white line, drop face) | `ledge`, `kerbStone` come close | a generator `platformEdge` (`length`, `height`) |
| Platform canopy (posts, roof, valance) | none | a generator `canopy` (`length`, `depth`, `posts`) |
| Bench | `bench`, `chair.row` | nothing |
| Clock | `wallClock` (`hour`, `minute`) | nothing |
| Ticket counter with a window | `counter.bar` | a generator `ticketWindow` (`width`, `open`) |
| Levers | none | a generator `leverFrame` (`levers`, `pulled`) |
| Signal (arm and lamp) | none | a generator `signal` (`clear`, `lit`) |
| Lamp post, wall lamp | core's street lamp, `lamp.wall`, `lamp.floor` | a preset `lamp.platform` only |
| Luggage | `crate`, `barrel`, `box.toy` | a generator `trunk` (`width`, `straps`) |
| Porter's barrow | `trolley` | nothing |
| Timetable, name board, notices | `noticeboard`, `sign.cream`, `post.sign`, `glyphs.json` lettering, the level's `lettering` | nothing |
| Key and its cabinet, lockers, shelves | `keyCabinet` (`open`), `locker`, `shelving`, `cabinet.filing` | nothing |
| Stove or heater | `radiator` | nothing |
| Fence, trees, hills, clouds | `fence.picket`, `tree.pine`, `bush`, `hill.far`, `hill.near`, `cloud`, the level's `sky.horizon` | nothing |
| Sky and weather | `addSkyPasses` (stars, rain, glow, shafts, particles), 6 times of day | nothing |

So seven generators, one preset and two photos are missing. No asset is drawn by hand, generated by a service or bought.

**The cast.** On `claude/last-light-ada` (`extensions/figures/src/shared/*/library/*.json`,
`extensions/character-kit/src/features/fashion/`): a character is a `CharacterDef` (sliders, genes, skin, gait, hand,
face, hair physics, outfits as lists of garments, its own swatches). There are 5 gaits (`brisk`, `strut`, `loose`,
`bounce`, `still`), 7 stands (`handOnHip`, `armsCrossed`, `handInPocket`, …), 8 seats (`upright`, `slump`, …), 19 actions
(`wave`, `point`, `nod`, `sit`, `handshake`, …), 13 painted garments (`tee`, `jacket`, `coat`, `waistcoat`, `trousers`,
`shoes` with `boots`, `belt`, `cap`, …), 3 cap styles (`nurse`, `peakedCap`, `flat`), 7 fabrics, about 20 hair styles,
and 1 item (`torch`).

| Person | Needs | Have | Missing |
|---|---|---|---|
| Traveller (walked) | long coat, trousers, boots, a case in hand | `coat`, `trousers`, `shoes` (`boots`), gait `brisk` | item `suitcase` |
| Stationmaster | dark jacket with buttons, waistcoat, peaked cap with a badge, a watch | `jacket`, `waistcoat`, `cap` style `peakedCap` with `mark`, stand `handInJacketPocket` | nothing in the wardrobe |
| Porter | waistcoat, shirt sleeves, flat cap, a lamp in hand, pulls a lever, sits on the bench | `tee` (`sleeves`), `waistcoat`, `cap` style `flat`, seats, `point` | item `handLamp`; a pose `pullLever` (a `figure-poses` file, data) |
| All three | to be files Characters opens | nothing | **a content kind for a painted character** (stress row 3): the largest gap |

Content kinds the framework reads from a game's `content/` (the `folder:` names in `packages/` and `extensions/`):
`levels`, `figures`, `figure-actions`, `-clips`, `-gaits`, `-hair`, `-headwear`, `-items`, `-poses`, `-rigs`, `-seats`,
`-stands`, `-swatches`, `world-props`, `world-swatches`, `world-kits`, `cutscenes`, `lines`, `storylets`, `beats`,
`systems`, `nav`, `puzzles`, `audio`, `feel`, `hud`, `help`, `canon`, `credits`, and the single files `tuning.toml`,
`look.toml`, `editors.toml`. `games/base-3d` uses `levels`, `figures`, twelve `figure-*` folders, `world-props`,
`world-swatches` and `tuning.toml`, routed to Levels 3D, Characters and Tuner; the 3D template makes the same shape.

## 3. The plumbing

- **An example** is `examples/<2d|3d>/<module>/<module>-<name>.ts` with a header (`Shows`, `Controls`, `Packages`,
  `Difficulty`, `Tier`; optional `Host`, `Golden`, `Pending`). `tooling/examples-runner/src/catalog.ts` finds it; the
  catalog test fails on a file that breaks a rule: an unknown module, more than 100 code lines, a relative import, an
  import that is not the umbrella, Zod or a listed extension's declared entry. The runner (`examplesRunner` in
  `vite.config.ts`) serves each at `/<module>/<name>/`.
- **Its journey** is `examples/3d/tests/e2e/<id>.test.ts` (22 files today, 21 journeys and a helper), run by
  `pnpm --filter @af-examples/examples-3d test:e2e` under the shared fake host, in two projects, both landscape phones
  (`Pixel 7 landscape`, `iPhone 14 landscape`). There is no portrait project.
- **Its picture** is `<module>/<module>-<name>.png`, used only when `screenshots-approved.json` in the examples folder
  names it. `find examples/3d examples/3d-story -name '*.png'` finds none: no 3D example has a recorded picture.
- **Its site page** does not exist for 3D. `site/src/shared/framework/examples.ts` and `site/playground/build.ts` read
  `examples/2d` only, and `playgroundCatalog` drops any example that imports an unpublished extension. The playground
  compiles an example in the browser against three runtime files (`@automata/framework`, `zod`, `@automata/ui-screens`)
  under a 460 000 B gzip budget (`site/playground/src/runtime-size.ts`); 3D and its kits are not in it. Whole games are
  shown another way, as built demos (`site/scripts/build-demos.ts` into `static/demos/<slug>/`).
- **So deleting the old 3D examples changes 0 site pages.** It touches: `examples/3d` (138 tracked files with
  `examples/3d-story`, 21 example files, 22 journey files, the `wardrobe` package), `examples/README.md`,
  `examples/3d/README.md`, `catalog.ts`'s module lists, `pnpm-workspace.yaml` (`examples/3d/wardrobe`), `knip.jsonc`,
  root `package.json` (`style`, `source-names`), `tooling/examples-runner/tests/unit/ports.test.ts`,
  `tooling/repo-hygiene` (3 files), `extensions/systems/README.md`, `extensions/character-kit`, `-cutscenes`,
  `-lcd-panel`, `-retro-crisp` (a README or test line each), `packages/3d` (6 files), `games/base-3d` (1),
  `docs/provenance`, and the Schematic journey that plays `examples/3d-story`. `.github/workflows/3d.yml` names the
  folder `examples/3d/**` and the packages `@af-examples/examples-3d` and `@af-examples/3d-story`: the set keeps both
  folders and both package names, so no workflow file changes.
- **New site pages:** one per example and one for the story, plus the examples index and the home's examples strip.

## 4. Work in flight the set builds on

| Lane | What the set needs from it | State |
|---|---|---|
| 3D ship plan | `@automata/3d` and twelve kits as built, public packages (`world-kit`, `lcd-panel`, `retro-crisp`, `figures`, `character-kit`, `places`, `sectors`, `nav`, `level-2d`, `systems`, `narrative`, `cutscenes`); B10 empties `UNPUBLISHED_EXTENSIONS` in `catalog.ts`. `interact`, `hud` and `pipelines` stay private | 0 of 24 tasks |
| Editors v2 landing | Task 6, one page that holds every editor (stress row 1); Task 7, the site's try-it | 0 of 11 tasks |
| `last-light-camera` | `lensMm`, `focusBounds`, `lead`, `peekReach`, `yawDeg`, `rotate` in a view; the occluder rule; every shot at a whole texel | not on `main`; 9 commits ada does not have |
| `last-light-ada` | `density: 2`, `grid`, `dimmest`, `holdSkinHue` on `paintedFigure`; the lcd-panel screen filter | not on `main`; 22 commits camera does not have |
| `3d-night-regression` | Night darker than day again (night / day 0.66 on base-3d, was 1.18) | two fix commits, not on `main` |
| Scope rename | `@automata/*` becomes `@automataframework/*` by one codemod, re-run on the `main` of the day. `@af-examples/*` is untouched | rehearsed, not applied |
| Editors stress audit | The gaps below | audit only |

Stress-audit gaps the set would meet, and what the plan does about each:

| Row | Gap | The set |
|---|---|---|
| 1 | No one page for every editor | waits for v2 Task 6 |
| 2 | Levels 3D: a tap on a prop selects the room | a task in the plan (S3), unless the editors lane takes it |
| 3 | Characters cannot open a painted character | tasks C1 (the kind) and S4 (Characters opens it) |
| 4 | Audio reads a recorded file as silent | not met: the set's sounds are synth voices only |
| 7, 8 | No form for a view's fields, a prop's `with`, a wall's dado | not blocking: the file is kept byte for byte; listed as known |
| 11 | A whole number saved as `X.0` | a task in the plan (S2) |
| 12, 15, 16 | No editor for storylets, `look.toml`, the HUD | the set keeps these files few and lists them as "no editor yet"; a question for the coordinator |
