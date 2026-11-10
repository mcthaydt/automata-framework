# The Last Light's clinic in AF's 3D level: design

- **Date:** 2026-11-10.
- **Status:** draft, waiting for the Owner's approval.
- **Gap analysis:** [`../2026-11-10-clinic-in-level3d-gap-analysis.md`](../2026-11-10-clinic-in-level3d-gap-analysis.md).
  Read it first: it lists every part of the clinic and what AF has for each.
- **Source:** The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`, the commit every earlier conversion
  into AF was made from.
- **Next stages:** the plan, then the plan audit, the build, the build audit and the fixes, each in its own session,
  handed off through committed docs.

## 1. Intent

The Owner wants AF's 3D level to be able to recreate The Last Light's levels, starting with the clinic. For this
first step, the bar is the look. The Owner's words (2026-11-10):

- "Just recreate the clinic."
- "It just needs to look nearly identical."
- "Still views from three cameras, and the gameplay camera." The Owner chose still frames over a live, playable
  camera.
- "1": the clinic's hand-written dressing becomes placeable level pieces, not clinic-only drawing code.

The clinic proves that the level format and the renderer can carry a real game's level. The dawn clinic, the bay and
the prologue come after it and reuse what it adds.

## 2. Goals

1. **The clinic loads from data.** Its level is one `af-sector/2` file, plus content files that AF games already read:
   world props, swatches, lamp kinds and a figure. No clinic-only drawing code exists.
2. **It looks nearly identical to the original.** Side by side, each frame in section 4 reads as the same place:
   the same rooms, furniture, lamps and pools of light, haze, moonlight, grime and colour. Small pixel differences are
   accepted.
3. **What it adds can be reused.** Each new field and piece works in any AF level, and the 3D editor can place it.

## 3. Non-goals

- Play: walking, input, collision, the Night Nurse, the puzzle, the systems, fire spreading, cutscenes, dialogue,
  saves, the HUD and the minimap. Their data is already converted as test fixtures. Wiring them together is later
  work.
- Any state of the clinic but the opening one (section 4.2).
- Audio, the FMV, and the cutscene baseline shot `sighting`.
- The other scenes.
- Building the render extensions. EnvironmentBuilder's project builds those (section 6).

## 4. What "nearly identical" means

### 4.1 The frames

The judged set is 11 frames, all at 1024 × 768:

| Frame | Camera | Ada |
|---|---|---|
| `zone-hall`, `zone-corridor`, `zone-closet` | Each zone's authored camera (`level.ts` `ZONES`: look, distance, `x`), with no follow and no dolly | Not in frame |
| `play-hall`, `play-ward`, `play-corridor`, `play-supply` | The play camera with Ada at the baseline spots (`scripts/verify/shoot.mjs`): hall `[0, 3.2, π]`, ward `[-2.6, 2.6, π]`, corridor `[0, -3.0, π]`, supply `[3.0, -4.2, π/2]` with the supply door open | Standing at the spot, facing as given |
| `play-*-turned` (4) | The same four, turned one 45° step (Q) | As above |

The zone stills need only a camera pose, which AF's angled camera can already take. The play frames need
EnvironmentBuilder's camera rig (follow, the dolly and the 45° turn), so they wait for it.

Each frame is taken twice: with the picture effects off, and with them on (LCD and dither). "Off" frames can be
compared as soon as the geometry, props, lamps and core look land. "On" frames wait for EnvironmentBuilder's
filters.

### 4.2 The state

The opening state, as in the Owner-approved baselines (`docs/verification/baselines/clinic/` in The Last Light,
taken 2026-10-22 at 3–7 s of play):

- the power is out;
- the curtains are hanging, the supply door is shut (open for `play-supply`) and the key cabinet is shut;
- the moonlight is up, along with the desk lamp, the monitor glow and the fill lamps;
- the Nurse is dormant and out of frame.

### 4.3 The reference frames

The Last Light's approved baselines show the HUD and the debug line, so they can't be compared directly. The build
re-shoots the reference from The Last Light at `92e6704`, using its own `shoot.mjs` with `PLAY_ONLY=1`, the fake
clock, the seeded `Math.random`, and the HUD and debug overlay hidden. It also adds the three zone stills and the four
turned frames. These reference PNGs are committed with a README giving the commit, the command and the date, the way
The Last Light records its own baselines. If `PLAY_ONLY` still shows the HUD, the build adds a flag to the capture
script, run from a scratch copy, not committed to The Last Light.

### 4.4 Judging

- **The Owner judges** a compare page that shows each frame as reference, AF and difference, side by side.
- **The compare tool also measures** each frame on a downscaled copy: the mean colour difference (ΔE) and how much
  the edges overlap. The numbers go into the compare page and the plan's log.
- **Once the Owner approves the frames,** those numbers become the regression bounds. A later change that moves a
  frame past its bound fails the check. Bounds are measured, never written by hand.

## 5. Approach (chosen by the Owner, 2026-11-10)

| | Approach | Trade-off |
|---|---|---|
| **Chosen** | **Convert once, and make the hand-written dressing into placeable level pieces.** A converter writes the clinic as an `af-sector/2` file and content files. Each piece of `dressClinic` that shows in the opening state becomes a reusable kind of thing a level places. | It costs more up front: each piece needs a schema, a builder and a test. In return it is all data, the editor can place it, and the dawn clinic and the bay reuse it. |
| Rejected | Port `dressClinic` as clinic-only drawing code in the example | Faster and the closest match, but part of the clinic would not be data, and every later scene would repeat it. |
| Rejected | Rebuild the clinic by hand in the 3D editor | Slow, drifts from the original, and leaves no record of where each number came from. |
| Rejected | Port The Last Light's renderer (`stage.ts` and the dressing) wholesale | Duplicates the render extensions EnvironmentBuilder's project builds. |

## 6. Who builds what

The Owner agreed this split with EnvironmentBuilder's coordinator (`session_01HNdX7MmXG4n9XJgnAXgAik`) on
2026-11-10:

- **EnvironmentBuilder's project** builds room visibility, the camera rig, fog, indirect light, bloom, and the crisp,
  retro and LCD filters. They live in `automata-framework/extensions/<name>`, each with an example. They read AF data
  through Zod schemas, never The Last Light's types. Their order: room visibility and the camera rig, then fog and
  indirect light, then bloom, crisp, retro and LCD. The agreed inputs are recorded in the gap analysis.
- **This work** builds everything else in section 7. That covers the converter, the level and content files, the
  new level fields and pieces, the core lamp kinds, the GLB props, Ada's figure, the clinic example, the reference
  frames and the compare tool.
- **This work never builds a stand-in** for an EnvironmentBuilder extension. The frames that need one wait for it,
  and the plan says which.

## 7. The design

### 7.1 Where things go

| What | Where |
|---|---|
| The clinic: level, content, models, figure, compare page, reference frames | A new private example, `examples/3d-clinic`, shaped like `examples/3d-story` |
| The converter | `examples/3d-clinic/scripts/convert-clinic.ts`, run once against a checkout of The Last Light at `92e6704`. Its output is committed, and the converter stays to show where the numbers came from (as the Plus converters did). |
| New level fields | `packages/3d/src/shared/level/` (`af-sector/2`, as a minor version if the codec needs one) |
| New lamp kinds | `packages/3d/src/features/world/library/lamp-kit.json` (core; EnvironmentBuilder's coordinator confirmed this is not theirs) |
| Drawing what the builder skips today | `packages/3d/src/features/world/` |
| GLB model props | A `model` prop generator in `packages/3d`, on the existing `parse-glb.ts` and `load-models.ts` |
| The new placeable pieces | `extensions/world-kit` as prop generators (`kind`) and markings (`decals`), since core draws no decals by design |
| Provenance | A row in `docs/provenance/sources.md` for the converter, the models and the reference frames |

### 7.2 The level file

`examples/3d-clinic/content/levels/clinic.af-sector.json` holds:

- **Sectors and masses:** as in the existing fixture (`extensions/sectors/src/testing/fixtures/clinic.af-sector.json`),
  which the converter regenerates. Its output must equal that fixture for every field the fixture holds.
- **Surfaces:** the clinic's materials and textures (`counterTop`, `ceilingTile`, `floorDim`, `kick`,
  `counterFront`, `cap`) as world swatches, converted from The Last Light's DUEL ramps and textures.
- **Props:** the 44 placements in `props.ts`, plus the stock on the shelves, each one `use`-ing a world prop. A
  model's fit (`size`, `uniform`), brightness (`gain`) and mount (`wall`, `ceiling`) go in the prop's `with`.
- **Lamps:** the 15 lamps from `level.ts`, at their opening-state levels, with the bounce points.
- **Views:** the three zone cameras and the play spots from section 4.1. Each sector's `view` names its zone's
  camera.
- **Dressing:** every piece of `dressClinic` that shows in the opening state, placed as a prop or a marking (7.5).

### 7.3 New fields

Each is optional, so no existing level changes:

- On a lamp: `radius`, the pool of light it lays on the floor; 0 means none.
- On a level: `bounce: [x, y, z][]`, the indirect light's bounce points (EnvironmentBuilder's input).
- On a view: what the camera rig's zone needs (`look`, `distance`, `x`, `follow`, `depthFollow`, `enterMargin`). The
  names come from EnvironmentBuilder's spec once it is written. This work only stores them.
- Room visibility's policy (rooms, which rooms each zone sees, mass owners) in whatever field EnvironmentBuilder's
  schema names. Again this work only stores it.

### 7.4 What the builder learns to draw

`packages/3d`'s world builder draws, from fields the schema already has:

- trim bands: `skirting`, `capital`, `wainscot`, `rail` and `cap`, with `trimDepth` and `trimTexture` (the reception
  counter's kick, front and top);
- masses;
- handrails and pilasters;
- a wall window's bars and its moon glass, checked against the original.

`hideFrom` and the cut walls belong to room visibility (EnvironmentBuilder's).

### 7.5 The pieces

From the opening state of `dressClinic` (gap analysis section 2), each one a world-kit kind with a schema, a builder
and a test:

| Piece | What it draws |
|---|---|
| `moon-shaft` | A barred window's moonlight, falling diagonally to a striped patch on the floor |
| `light-pool` | The additive speckled pool under a lamp (or the lamp's `radius` alone, if that is enough; the builder decides) |
| `puddle` | A puddle that mirrors the light that falls on it |
| `pipe-run` | Pipes and conduits along a wall or down a corner, with a riser |
| `grime` | Grime along skirting and corners, worn paths, dropped papers and debris, by seed and density |
| `screen` | A lit screen with static frames or a flat glow (the CRT, the monitor); frames are seeded |
| `plaque` | A lit or unlit plaque (the exit sign), its state a prop state |
| `curtain` | A ward curtain and its rail, hanging, or half torn from the rail |
| `shelving` | A steel shelving bay with its levels, for the stock to stand on |
| `ceiling-tile` | A ceiling tile hanging down |
| `cable` | A cable run from a prop to a wall |
| `wall-notice` | Frames, posters, the noticeboard and its pinned things, as markings |

The opening state may need fewer or more pieces than this table. The plan settles the list by going through
`dress.ts` line by line, and every piece the reference frames show must have a home.

### 7.6 Ada

`src/render/figure/characters/ada.json` is the same family as AF's figures: genes, garments, a shared rig. It is
converted to AF figure content (with `character-kit` for garments AF lacks) and placed as `cast` at each play spot,
in her standing pose.

### 7.7 The compare tool

A browser page in the example, plus a Playwright suite:

- it renders each frame of section 4.1 in AF on a fixed clock;
- it shows the reference, the AF frame and the difference side by side;
- it writes the measures in 4.4.

The suite runs in Chromium. The cross-engine parity of the sim is not involved, because nothing here runs the sim.

## 8. Order

1. The converter and the level file: sectors, masses, props and lamps. Check: the converted sectors equal the
   existing fixture.
2. The reference frames re-shot from The Last Light, and the compare tool with its first measures.
3. Core: the lamp kinds, `radius`, `bounce`, the `model` prop generator, and the builder's trim bands, masses,
   handrails and bars.
4. Surfaces and Ada.
5. The pieces in 7.5.
6. The Owner judges the "off" frames.
7. As each EnvironmentBuilder extension lands: wire it in, and move the frames it affects. The "on" frames come last.

## 9. Constraints

- AF's laws and house rules (`AGENTS.md`): tests first, `#src/` imports, at most 600 lines a file, comments that
  say why, `pnpm check` before committing, and `docs/refactor/progress.md` updated with the work.
- An extension never edits core, and core never imports one.
- No Last Light type, message or name is copied into core. The converter is the only code that reads The Last Light.
- Facts come from artifacts: every measure, size and count in the plan's log is measured.
- A visual change is accepted only after looking at the reference, actual and difference images, with each change
  explained.

## 10. Anti-goals

The work fails, even if it runs, if:

- the clinic looks like a different place, or only looks right from the five baseline spots;
- any of its pieces works only in the clinic;
- it needs The Last Light's checkout to build or run (only the converter needs it);
- it duplicates an EnvironmentBuilder extension, or waits on one without saying so.

## 11. Calls I made, for the Owner to check

- The 45 or so GLB models the clinic uses (about 20 MB, made for The Last Light with GPT image and Meshy) are copied
  into the example, with their provenance recorded.
- The clinic lives in `examples/3d-clinic`, not in `games/`.
- The zone stills leave Ada out. The play frames include her.
- The reference is re-shot without the HUD, rather than masking the approved baselines.
- The bounds become a check only after the Owner approves the frames.

## 12. Left to the builder

- Field names inside `with` for model props.
- How `light-pool` relates to a lamp's `radius`.
- The final list of pieces (7.5).
- The downscale size and the edge measure (4.4).
- Whether a new field needs `af-sector/2.1`.
