# Editor and level-format gaps the clinic work met (rough, 2026-11-11)

Things batch 2 had to work around in a converter or a spike script that an editor, or the `af-sector/2` format, should own.
Each is what was done, and what it points to.

1. **Placing a thing against a wall.** A wall piece (notice, plaque, pipe, CRT) is a prop built facing +z at an origin, so the
   author works out `angle` from the wall's normal (90 south, 0 east, 180 west, −90 north) and nudges the origin 1 to 4 cm off the
   wall by hand. A "mount on this wall segment" placement (wall id, distance along, height) would remove the arithmetic
   and the mistakes (a plaque at x 4.86 poked through the wall until it was moved to 4.84).
2. **Paths.** Pipe runs and cables are lists of world points, stored relative to the first. An editor needs a polyline tool
   with snapping to walls and the ceiling, and the level a path-type prop whose points are world points.
3. **Fit a preset to a box.** The source's models carry a world box; the kit's presets carry their own sizes. `fit` (new, in the
   world kit) scales a generator to a box. The format has no notion of it: it is a `kind` with `of`, `with`, `size` and `turn`, so
   an editor sees a generic prop. A first-class "size" on a place (any preset, any box) would be the editor's way in.
4. **A prop's light and the level's lamps.** The kit's desk lamp carries a light; the level has its own desk lamp
   at the same spot. The converter strips the preset's light. A prop's light should be able to name the level lamp it stands for
   (`lampId`), so the glow dims with it and nothing is lit twice.
5. **Pieces that follow a lamp's level.** The light pools are static veils at the opening's levels (the source scales each
   pool by its lamp). `PieceStates` moves lamps; a veil (or any part) cannot yet follow one.
6. **Which swatches a preset uses.** A generator names default swatches (`bookCream`, `leatherBlack`, `cordBlack`) that appear
   nowhere in the preset. The converter had to find them by building and reading the "unknown swatch" problems. A generator should
   be able to list the swatches it can use, so a library copy is complete by construction.
7. **Rooms and cut groups for props.** A wall's pieces carry a `cut` group so room visibility hides them with the wall; a
   prop does not. The hall's north-east pipes and noticeboard draw in the supply and corridor frames, where the source hides them.
   A prop needs an owner room (or a wall to ride on), authored, not guessed from where it stands.
8. **Textures on the floor and walls.** The source's floor is a tile-grid texture and its pictures read as steeper because of
   it. A swatch can name a photo texture, but `drawWorld`'s `colourOf` path takes a flat colour; the spike has no way to show the
   kit's `tileFloor`. The spike needs the textured-swatch path the world view has, and the editor a floor-pattern picker.
9. **Orientation of kit generators.** A bed is built lengthwise along x with its head at −x, a bench along x, a wheelchair facing +z.
   The author must know each; `turn` is a number found by trial. Each generator should declare its axes, so an editor can show them.
10. **Axis-aligned veils.** A moon shaft's patch is square to the wall; the source's runs diagonally along the shaft. A
    veil with a turn about y (or the shaft taking an aim) would close it.
11. **Closed curtains.** The kit's curtain is two folds drawn back; a drawn-closed curtain is `panel` = half the width, a trick.
12. **Tests of extension presets in core.** Core's clinic test cannot build the dressing (core has no such generators), so
    the level's test is split between `packages/3d` (stand-in models) and `extensions/world-kit` (kit pieces). A level that
    names an extension's presets should say which extension, so a checker can load it.
