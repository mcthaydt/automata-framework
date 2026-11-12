# Figures (`@automata/figures`)

A procedural character painter. A character is data: gene sliders, a gait, and outfits as lists of garments from the
library. One generator turns that into a rigged, posed figure, and a CPU rasteriser paints it as pixel art (DUEL palette,
a painted key light, outlines) in 8 directions and in motion, with a normal map that the lighting feature lights with
lamps and a time of day. Scripted actors play it on a timeline. It is free to run: no API, no paid stage.

It is private and unpublished (`"private": true`). Its only consumer is the character kit's door,
`extensions/character-kit/src/shared/figures/door.ts`, the one file that imports it. The stage contract, which that door
relies on, is [`docs/contract.md`](docs/contract.md); the scripted actors are [`docs/actors.md`](docs/actors.md).

`@pixi/3d` is a closed beta, vendored in `vendor/pixi-3d/`. Keep it, and every build of the viewer, private.

## The base pair

`src/shared/base/base-pair.ts` holds the base pair, one man and one woman: the figure every character starts from, in
painted-on blocks (no garments), barefoot. Every visual change is judged on them.

```sh
DENSITY=2 pnpm --filter @automata/figures render out    # <id>-turn.png, <id>-walk.png, <id>-hero.png, at 1× and ×8
pnpm --filter @automata/figures lit out/lit               # the pair under a few lighting setups
pnpm --filter @automata/figures actors out/actors         # the actions' contact sheet
```

`DENSITY=2` doubles the pixels per metre (128×192 cells).

## Layout

The package follows the framework's layout (`AGENTS.md`). `pnpm boundaries` and `tests/unit/layers.test.ts` enforce it.

- `src/entries/`: the three public entries, re-exports only. `index.ts` is the surface, `kit.ts` the painter's toolkit
  (the rasteriser, the palette, the primitives and the rig names a door's own garments need), `view.ts` the Pixi 3D view,
  the only entry that loads Pixi. Anything they do not export is internal.
- `src/shared/<layer>/`: the pipeline, one folder per layer, each with its own `library/*.json` where it has data:
  `math`, `body` (sliders to measures, the skeleton, the primitives, the head's form), `paint` (the palette, the G-buffer,
  the painter in fourteen phases, the fabric registry), `lighting` (lamps, times of day, a figure lit by the world or lit
  as a sprite by its room), `motion` (gaits, stands, holds, seats), `hair`, `outfit` (garments, face marks, items,
  swatches, the body's profiles as a query), `figure` (character files to cast members, the runtime figure, the review
  frames, the cloth coordinates a fabric is laid by), `base` (the pair), `actors`, `stage` (the contract: cell, camera
  pose, frame and its CPU reference).
- `src/features/view/`: the figure in a Pixi 3D scene (`CellSprite`, `StageView`, `FigureSprite`, the camera reading). The
  only code that imports Pixi.
- `scripts/`: thin CLIs for the sheets and for recording the goldens. `viewer/`: the base pair on the gameplay camera in a
  Pixi 3D scene, for the eye (`pnpm --filter @automata/figures viewer`; Q/R orbit, W walk, C crisp, `?free` the free orbit).
- `tests/`: `unit/<layer>/` (and `unit/golden/`), `browser/` (the view against the painter), `fixtures/` (the goldens' data
  and the browser suite's cases).
- `docs/`: the stage contract and the actors' guide. They are inside the package because the repository's `docs/` is a
  published surface.

The layers, lowest first: `math → body → paint → lighting → motion → hair → outfit → figure → base → actors → stage →
entries/index → entries/kit → features/view → entries/view`. A module imports only from its own layer and the ones
below. A layer's library JSON is read only by that layer, through a strict Zod schema (`*.schema.ts` beside the reader):
a stray key or a wrong type fails when the library loads. There are no cycles and no test beside the source.

## The goldens

Five goldens fail on a change of a single texel:

| Golden | What it pins | Test | Record it with |
|---|---|---|---|
| base | every pixel of the pair's sheets at D1 and D2 | `tests/unit/golden/base.test.ts` | `pnpm --filter @automata/figures golden base` |
| lit | the pair lit | `tests/unit/golden/lit.test.ts` | `… golden lit` |
| actors | every actor frame | `tests/unit/golden/actors.test.ts` | `… golden actors` |
| sprites | an md5 per frame of each member's hero, 8 standing views and walk, at D1 and D2 | `tests/unit/actors/actors.test.ts` | `… golden sprites` |
| sprite | an md5 per frame of the pair as a sprite lit under four lights | `tests/unit/golden/sprite.test.ts` | `… golden sprite` |

Their data are in `tests/fixtures/golden/`. A re-record is a deliberate visual change, and its commit says what changed
and why. A hash that moves is investigated, never re-recorded to make a test pass. `tests/unit/paint/identity.test.ts`
pins an md5 for the materials cases (`chromeDark`, a light gloss, a matte black, an unfabricked lit figure) that a painter
change must not move, and `tests/unit/hair/ulp.test.ts` and `tests/unit/body/face-d2.test.ts` pin the cells that once
depended on the last bit of a float (Node 22 and 24 differ there): a pole's normal faces the way its row does, so an arm64
and an x64 machine paint the same cell.

The commit hook runs the `goldens` project (the goldens, the identity pins, the layer and API tests: about a minute);
`AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit` runs every unit test as well. `pnpm --filter
@automata/figures test:browser` runs the browser suites (below).

## The browser suites

`tests/browser/` draws the stage on a real GPU and holds it to the CPU: for every case in `tests/fixtures/view-cases.ts`
(the 8 standing views of each base figure, the sheets' frames, zooms, lit scenes, the gameplay camera crisp, ties, an
overlap and a wall cutting a figure) the readback of `StageView` equals `compose(frame)` byte for byte, or, for a
perspective frame at true scale, holds the cell's palette. The `browser` project draws with WebGL, the `webgpu` project
with Pixi's WebGPU renderer (`AF_WEBGPU=software` gives a machine with no GPU a software adapter; a browser whose WebGPU
draws no frame skips, in words). Chromium only. Run them after a change to the painter, the stage or the view.

## Hooks, and the machinery never to cut as dead

A game adds its wardrobe through five registries, all empty here (so no base pixel moves): H1 garment kinds
(`registerGarment`) and H2 outfit hooks (`registerOutfitHooks`: the hair's tie and the hand's anchors), H3 hair pieces
(`registerHairPiece`) and H4 hair finishes (`registerFinish`), and H5 fabrics (`registerFabric`: a tile of tone labels a
swatch names). A game can add a garment; it cannot override a base one. It widens `Garment` by augmenting `GarmentKinds`
where the garments are declared, and fills the libraries (`SWATCHES`, `HAIR_STYLES`, `ITEMS`, `GAITS`, `POSES`, `SEATS`)
at load. The character kit's wardrobe is the framework's own use of them.

Behind them is generic machinery that no base figure reaches. **Never cut it as dead.** Each has a test under `tests/unit/`
that draws a base figure with it and without it:

- hems and the shoe region: `outfit/regions.test.ts`; `top.cuffs`, `top.collar`, `eyes.stubble`: `outfit/options.test.ts`; the
  outfit hooks: `outfit/hooks.test.ts`; sheer cloth, the shod foot and the head's form: `paint/sheer.test.ts`,
  `outfit/shoe-form.test.ts`, `motion/form.test.ts`;
- prints and the skirt and cape groups: `paint/prints.test.ts`; the painter's material features (holo, mirror, see-through,
  stain and wash, strands, a dark gloss as leather): `paint/materials.test.ts`, pinned by `paint/identity.test.ts`;
- a full bob (the scalp's `foot`, `reach`, `under` and `parting`, and the library's `bobFull`): `hair/bob.test.ts`;
- hair options (the sheen finish, `capped`, cornrows, beads): `hair/options.test.ts`; the hair hooks: `hair/hooks.test.ts`;
  the low pony, the bun, the fall, the `smooth` and `curl` finishes: `hair/hang.test.ts`; a fringe and front hair:
  `hair/fringe.test.ts`, `hair/front.test.ts`;
- legacy gait fields (`twitch`, `idleLoop`, `idlePoses`, `shuffle`, `plumb`): `motion/legacy-gait.test.ts`; seats:
  `motion/seats.test.ts`; item taper and `itemOf`: `outfit/items.test.ts`; drawn moods: `outfit/moods.test.ts`;
- `Figure.depth` (finite at every opaque texel, restored from the cell cache): `figure/depth.test.ts`; per-texel depth in the
  stage: `stage/stage.test.ts`, `stage/depth-cases.test.ts`; a base figure through `stageFrame` with the light hook, a fabric
  and world lamps: `stage/light.test.ts`;
- the face's tone budget (`Material.face.light`) and the `skinFair` swatch: `paint/face-tone.test.ts`;
- the `eyes` garment's face options (`mark`, `nose`, `mouth`, `keep`): `figure/eye-marks.test.ts`;
- the diversity sliders and pieces, each drawn with and without it (at its default the pair is unchanged): fat
  (`body/fat.test.ts`), the face at D2 (`body/face-d2.test.ts`), the eyes (`figure/eyes.test.ts`), asymmetry
  (`body/asymmetry.test.ts`), `bust` and `seat` (`body/bust-seat.test.ts`); every slider pushed to either end:
  `body/sliders.test.ts`;
- H5 fabrics and the cloth channel: the registry's checks, a base figure with and without a fabric, the head and held items
  untiled, the tile laid last, lit and under the light hook (`paint/fabric.test.ts`); the mapping (`figure/cloth.test.ts`);
- fit (`outfit/fit.test.ts`): a cuff hugs the arm, the collar is fitted to the neck, and a kind sized from `Wearing.body`
  clears every slider end; the light hook (`figure/light-hook.test.ts`).

## The painter's own rules

- **A figure's look is made by the CPU painter, and a scene draws its cells.** It never redraws a figure as a lit mesh.
  The package owns no camera: a pose is passed in and never changed.
- **The part index seeds the painter's grain.** Never reorder the parts a figure is built from. Parts of one surface share a
  `seam` number (the body's are 3000–3006); the painter draws no crevice or line inside a surface, so no segments show.
- **Colours snap to the DUEL palette; lighting moves a texel whole steps along its own ramp.** The light hook is the one
  exception: an outside light multiplies the albedo and snaps to DUEL, opt-in.
- **Never nudity or sex** (the pair wear painted-on blocks), and no costume or stereotype in any styling.
- **Everything is a generator plus data**, so it scales to any character: no per-character code, no hand-drawn pixels, no fit
  fixes for one character. If one character needs a fix, fix the generator.
- **The contract** (`docs/contract.md`): changing a `Cell` field, the kit entry or anything on its breaking-change list raises
  `STAGE_VERSION` and is written in its changelog. `tests/unit/api.test.ts` pins the export names of the two entries.
- Base is generic: no brand, character or content. A game's wardrobe and characters live in its own folders.

## The two compiler flags

The framework compiles under `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, and under `isolatedDeclarations`.
The painter arrived written without them, and this package's `tsconfig.json` switches the three off, so the painter's source
is exactly what it was. Turning them on is done folder by folder in a later workstream (tasks 21 to 27 of the builders-fold
plan); until then a non-null assertion is allowed in the files that have a `biome-ignore-all` line naming that task, and
`tsconfig.types.json` writes the declarations the kit's typecheck reads. Both go when the flags are on.

## Names this package shares with `@automata/3d`

Core's `@automata/3d` has a mesh figure with the same vocabulary (sliders, rig, registries), drawn as a lit mesh in 3D. This package's are the painter's: they feed the CPU painter that makes sprite cells. A game imports one or the other in a
file, never both; the character kit's door is the only file that imports this package, and `pnpm boundaries` keeps core
from importing it.

| Name | In `@automata/3d` | In `@automata/figures` |
|---|---|---|
| `Anchor`, `Body`, `Fit`, `Wearing` | a mesh figure's anchors, body rings and the garment's fit | the same ideas for the painter's garments |
| `CameraPose` | the angled camera's pose | the stage contract's pose a host passes in |
| `DEFAULT_HEAD`, `DEFAULT_SLIDERS`, `HeadShape`, `Sliders`, `Measure` | the mesh figure's genes | the painter's genes |
| `Decal`, `GROUP`, `Mesh`, `Part`, `Piece`, `Superquadric`, `superquadric`, `limb`, `placed`, `smooth`, `weights` | the mesh figure's geometry | the painter's primitives, rasterised on the CPU |
| `Fabric`, `registerFabric` | a mesh material's cloth tile | H5: a tile of tone labels laid over the painted colour |
| `Gait`, `Hold`, `ItemDef`, `Stand`, `HairStyle`, `TIMES`, `TimeOfDay` | the mesh figure's content types and the world's times of day | the painter's libraries, loaded through their own strict schemas |
| `Garment`, `GarmentKind`, `OutfitHooks`, `HairFinish`, `HairInput`, `HairPiece`, `registerGarment`, `registerFinish`, `registerHairPiece`, `registerOutfitHooks` | the mesh figure's registries | H1 to H4 of the painter |
| `J`, `JOINTS`, `Joint`, `Pose`, `Side`, `Skeleton`, `fk`, `MotionState`, `applyHold`, `evaluate` | the mesh figure's rig and clips | the painter's rig and motion |
| `headForm`, `onHead`, `skull` | the mesh hair's head and skull | the painter's, on the painter's skeleton |
| `Lamp` | a world lamp | a world lamp as the stage's lighting reads it |
| `SPRITE_STYLE`, `SpriteLamp` | the `spriteLight` look's style | the stage's `lightSprite` style, in whole DUEL steps |
| `V3`, `axisAngle`, `cross`, `dot`, `lerp`, `normalize`, `sub`, `oklab` | core's maths | the painter's own copies (the kit entry re-exports them for a door's garments) |
