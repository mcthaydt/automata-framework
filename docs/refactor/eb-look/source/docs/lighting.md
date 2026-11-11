# Lighting

A scene is lit per vertex, as The Last Light lights its rooms (`docs/reference/the-last-light/` are its frames). The
light is a number on each vertex, stepped, then interpolated across each triangle (Gouraud). The painter multiplies the
albedo by it and snaps the result to DUEL once. Everything that sets the look is in
`src/features/paint/library/look.json` (the profile), `times.json` (the times of day) and the lamp kit.

To tune: edit `look.json`, then `npm run board -- out/board` and look at the board beside the references.

## The model

`src/features/paint/vertex-light.ts`. At a vertex with world place `p` and unit normal `n`:

```
key   = ambient.level + max(0, n·key.dir) · key.level          (key.dir is (0.3, 0.8, 0.5), as given)
h     = p.y − floor(p);   fade = max(fill.fade[2], min(1, fill.fade[0] − h / fill.fade[1]))
fillK = (1 − |n.y|) · fill.level · fade
base  = AO(p, n) · (key · ambient.tint + fillK · fill.tint)
      + sun.rgb · max(0, n·sun.dir) · (not in the sun's shadow)
lamp  = (1 − d/range)² · max(0, n·toLamp) · cone                (0 past its range)
light = (base + Σ lamp · look.light.strength · level · strength(t) · colour · visibility) · shade
light = stepLight(min(look.light.max, light), look.light.step)
```

- **Tints** are `tintOf(hex)`: the colour scaled so its brightest channel is 1 (a tint sets the hue, its level the
  strength).
- **AO** (`occlusion.ts`) comes from the map: a floor darkens into a wall, more in a corner, a wall darkens at its foot
  and under its ceiling, and the floor round a piece of furniture darkens at its foot. It is computed once per vertex.
- **The sun** has a shadow map along the key (`light.ts shadowMap`), built only for a time with a `sun` and `shadow`. A
  vertex takes the share of a 3 × 3 grid of tests across its spacing (`sunVisibility`, `seg / 2` either side) that is lit,
  so a thin caster leaves a soft line, not a row of dots.
- **A lamp's visibility** is its cube shadow map sampled at the vertex (`perspective.ts cubeVisibility`), in quarters.
- **`strength(t)`** is the lamp's flicker and the runtime state's level and style (`light.ts strength`). The static
  terms are kept per vertex (`VertexLight`); only the strengths are applied per frame.
- **`shade`** is `look.shade ** sector.shade`: Build's whole steps darker (0.85 each). In first person the distance
  shading, `look.shade ** min(3, floor(dist / map.visibility))`, is a per-texel factor on top.
- **`stepLight`** snaps the brightest channel to the nearest `light.step` and keeps the hue.
- **Meshes are cut** (`world/subdivide.ts`) until no edge is longer than `look.seg` (0.35 m), so a vertex stands wherever
  a lamp's pool or a shadow's edge needs one.

## Getting it to texels

- **The diorama** (`view/render.ts`): the scene's soup is rasterised a second time with each vertex's light in the slots
  of its world place; `resolve` and `cleanup` give a G-buffer whose `place` is the per-texel RGB. It is re-lit only when
  the lamps' strengths, colours or the layout change.
- **First person** (`view/fp.ts`): `rasterPerspective` carries the light as three more vertex attributes, interpolated
  perspective-correct; `resolveLight` averages each texel's subsamples that belong to its own part.

## Colour, haze and the snap

`colour.ts`. A lit texel is `albedo × light × light.gain`, per channel, clamped to 1. The haze mixes it toward the veil:
`hazeShare(behind)` is 0 up to `haze.near` m from the focus, rising linearly to `haze.amount` at `haze.far`; the veil is
`haze.colour + haze.glow × light` (it glows near a lamp). The diorama's focus is the camera's centre; first person's is
`haze.focusFp` m from the eye. A time may set its own haze colour and amount (`times.json` `haze`, `colour.ts hazeOf`): a
clear day's air is pale and thin, a night's the profile's teal. Below the horizon the panorama is the haze colour (the
ground past the map, as far as the air), darkening toward the viewer as Build's floors shade (to half a quarter radian
down), and the horizon's layers stand on it, in the time's light (`× min(1, 0.3 + 1.6 × ambient)`: dark against a night
sky, a city's windows lit in rows). The one snap adds a Bayer offset (`dither.strength`) and takes the nearest DUEL colour.
A glowing texel (`emit`) takes no light: it is hazed and snapped.

## The look profile (`look.json`)

| field | what it is |
|---|---|
| `seg` | the longest triangle edge after subdivision (m) |
| `ambient`, `fill` | the defaults for a time that leaves them out: `level` and `tint`; `fill.fade` is the fill's height fade |
| `key` | the small key on the normal: `dir`, `level` |
| `light` | `step` (the light's step), `gain`, `strength` (a lamp at level 1), `max` (the cap per channel) |
| `shade` | the factor a whole sector shade step multiplies by |
| `ao` | the occlusion's constants (floor, corner, other, reach, wallBase, ceiling, foot, min) |
| `haze` | `colour`, `near`, `far`, `amount`, `glow`, `focusFp` (near 0: nothing before the focus is veiled) |
| `dither` | `strength` |
| `figureShadow` | what a figure's cast shadow multiplies a floor texel's light by |
| `figureLight` | a figure's sprite light: `ambient` (× the time's, at its chest), `threshold` (0–1 of the lights' strength: how much harder than the figure's mean a texel must face them to step), `ink` (the peak channel at or under which a texel never steps), `floor` (a light's least share of the figure in the flat light), `rim` (the share of the lights' strength an edge's outward direction must take to rim), `floorCap` (the most the lights' floors may add up to: a figure under several lamps is not hotter than its room) |
| `switches` | each pass: `outline` (off), `foliage`, `windows`, `sky`, `stars`, `rain`, `reflect`, `bloom`, `shafts`, `grade`, `particles`, `bounce` (off); `--before` in `npm run map` turns them off |
| `tone` | how far (OKLab) a lamp's own colour may be from its kind's |
| `kit` | the lamp kit |

## The lamp kit

A lamp names its `kind`; the kind sets its colour, its reach and its peak. A lamp may set `level` (held at the peak),
`range` (clamped into the band) and `color` (within `tone` of the kind's; a neon's may be any DUEL colour). A colour
off tone throws, naming the lamp (`look.ts resolveLamp`).

| kind | colour | range (m) | peak |
|---|---|---|---|
| `pendant` | #ffd59b | 3.5–6 | 1.0 |
| `bulb` | #ffce7f | 3.5–6 | 1.5 |
| `desk` | #ffbc4e | 3.5–5.5 | 1.25 |
| `fluorescent` | #eadbc9 | 4–8 | 1.25 |
| `sodium` | #ffbc4e | 6–10 | 1.25 (dusk) |
| `neon` | #ff7daf | 1.5–3.5 | 1.25 |

A kind marked `dusk` (the sodium street lamp, on its photocell) is dark by day: unlit while the time is not night
(`light.ts lampOn`, `isNight`), unless the runtime state sets its level or colour.

`Lamp.level` is the authored level; the runtime state's is `stateLevel`, and its colour `stateColour` (a script's, so
it is not checked against the kit).

## The times of day

`times.json`: `ambient` and `fill` (each `level` and `tint`), `sun` (`level`, `colour`; none at night), `haze` (`colour`,
`amount`; each left out is the profile's), `shadow`, the
key's direction if it has one, the sky, stars and rain. Night is a time with no sun or a weak one
(`light.ts isNight`: it lights windows and brings out the moths). `state.ts blendTime` blends the levels, mixes the
tints (and the haze's colour) in OKLab and fades the sun in and out.

## Figures

A figure is lit as The Last Light lit its sprites (its `ramp-light.ts`), the way a pixel artist lights one, not with the
room's raw per-vertex light (which, on a coarse body, bands across it, and leaves a figure with a lamp behind it near
black). The floor under the flat light (step 2) and the rim from each light's 2D direction (step 4) are this repo's, not
ramp-light's (which takes the raw mean N·L and the raw 2D component of a light): they are what lets a figure under a
pendant read (note 4 of the cycle-4 plan, `docs/superpowers/plans/2026-11-06-figures-read-surfaces-read.md`). FigureBuilder paints the cell with its own key bands (its light hook is unused
here), and the view lights the finished cell from its normal map (`stage/sprite-light.ts spriteLight`):

1. **The lights.** `VertexLight.spriteLights` takes the scene's lights at the figure's chest (its root + 1.1 m): the
   ambient × `figureLight.ambient` (no fill), and each lamp lit now and the sun as a direction toward it and its colour ×
   its reach there (falloff and cone) × its visibility (the lamp's cube map; the sun's shadow map, yes or no). A light that
   reaches nothing is left out. `paint/light.ts toCell` turns each direction into the cell's frame (x right, y up, z toward
   the camera): by the figure's azimuth round it (the diorama's is 0; first person's is where the eye stands) and the
   camera's pitch.
2. **The flat light.** (ambient + Σ each light at `max(the figure's *mean* N·L, figureLight.floor)` × its colour) × the
   sector's shade (first person also takes Build's distance shading), clamped to `look.light.max` a channel and stepped as
   the room's light is. It multiplies every texel: it sets how bright and warm the figure is, and never shades across it.
   The floor means a lamp that reaches the figure lights it from any direction. Why: a pendant overhead and behind meets
   most of a figure's normals edge-on, so its mean N·L is 0.05–0.11 and the figure took 0.26–0.35 of light a channel,
   a silhouette, where the floor under it took about 1. A texel still steps against the figure's true mean, so the floor
   does not touch the form. The floors add up, and under several lamps the sum lit a figure hotter than its room (cycle
   4's neonBar man read at luma 0.60 against 0.34 around him). So Σ strength × `figureLight.floor` over the lights is
   capped at `figureLight.floorCap` (0.8): above it, every light's floor is scaled down evenly. The cap lowers the floor
   only, never a light the figure faces (its mean N·L is over the floor and stays); with no lamps there is nothing to
   scale, and a cap of 0 takes the floor away. At 0.8 the man reads 1.00 and 1.04 of his room by luma (and 2.44 and 2.28 by
   edge) and no base frame moves: the base figures' sum is under 0.7.
3. **The form.** A texel whose own N·L (in lamp strength) is clearly above the figure's mean (by `figureLight.threshold` of
   the lights' total strength) takes the next lighter step of its own DUEL ramp; one clearly below, the next darker. The
   painted bands stay; the lamp's side brightens them.
4. **The rim.** A silhouette texel on the lights' side takes the lighter step. The lights' side is found from each light's
   direction in the cell's 2D frame (its x and y, normalised): an edge whose outward direction `o` has Σ strength ×
   max(0, o · d̂) over the lights of at least `figureLight.rim` (0.35) of the lights' total strength is rimmed. A light
   within `RIM_SIDE` (0.25, 14.5°) of the view axis, straight from the viewer or from behind, has no side and gives none.
   So a pendant above and behind (little 2D part) still rims the figure's top and its side.
5. **Clean edges.** A texel stepped unlike every neighbour of its own colour (two or more) takes their step, so the bands keep
   clean edges. The ink, the eyes and FigureBuilder's outline (`peak ≤ figureLight.ink`, `#000000`, `RAMP_OUTLINE`) never step.
6. **The snap.** Each texel's colour (its ramp step × the flat light) is snapped to DUEL, with no dither. A texel with no
   normal counts as facing the camera and is left out of the mean. Nothing is grown outside the figure: FigureBuilder
   already paints its outline.

The scene then hazes the figure with its own veil (`composite`, `FirstPerson.figures`).

**Exposure** (`figureLight.expose`, `view/expose.ts`; cycle 7). Two figures under one pendant differ in their colouring, so
one flat light can't serve both: a pale one runs hot against its ring while a dark one is a silhouette. So after step 2 each
figure's flat light is scaled by `n / top` whole light steps, applied before the snap (step 6), so the result stays on DUEL:
- **The trial.** For each step tried, the figure is lit alone, composited onto a copy of the room (the frame drawn before any
  figure and before the post passes) and measured there (`figureReads`' largest run) inside a box round its cell (± 4 texels:
  the ring of 3 and the edge's neighbour, so the measure equals the whole frame's). Nothing of the frame's rain, bloom or
  other figures enters it. In a dry frame the final read equals the trial's, to the digit; where rain or the post passes
  touch a figure they move its read after the trial, and exposure can't see that.
- **The steps.** `top` is the figure's flat light in whole steps (its peak over `light.step`); `n` is the largest step whose
  trial is not hot (`figure ≤ figureLight.exposeHot` × ring). `spriteLight` steps `n / top` again, which is exact, so the
  figure's light stays a whole number of steps. A figure that isn't hot, can't be measured (hidden, or off the frame: its box
  is empty) or has one step keeps its light.
- **The clamp.** If the figure's edge at `top` is at least 1.1 and the edge at `n` is under it, `n` rises to the first step
  whose edge is. The figure may then still be hot: that is a measured conflict, and `frameIssues` reports it (nothing
  waives it). The edge isn't monotone in the step, so a figure whose edge is under 1.1 even at `top` isn't clamped.
- **The cost.** 12–200 ms a base frame (14–32 ms without); a `tune-light` combination over the eight base rooms is about
  0.7 s (0.2 s without).
- It is on in `look.json` since cycle 7 (`"expose": true`).

### Checking it

A figure has to read against its room. `figureReads` (`view/readability.ts`) measures it on a finished frame: each figure
(the texels where the frame's depth is not the scene's, in 8-connected runs of at least 20) against the ring of scene
texels within 3 of it, by luma ratio and by edge-energy ratio (the figure's silhouette counts as its edge; the ring's
edge counts only against the scene). It reads as the stronger of the two, either way round, and The Last Light's rule is
1.1×. Luma alone is not enough: an interior figure is half its ring's luma, which reads as a silhouette, so the test
`tests/base/readability.test.ts` also holds the **edge ratio alone** to 1.1× in every frame whose map declares reads (at
main, seven of the eight interior figures were 0.55–0.97 by edge). `npm run board -- out/board` prints each figure's `read`, `edge` (E) and
luma (L), and flags any under 1.1, and any figure brighter than its ring by more than 1.1× as ` hot` (`L` is taken either
way round, so it cannot tell a hot figure from a dark one; the neonBar man was hot before the cap).

`npm run render -- out/base` prints the same line for every frame it draws (`readLine`, `view/view-frame.ts`; `(no figures)`
where there are none), so a regression shows in any render, not only on the board. `viewFrame` draws a map's frame as the
goldens and `render` do (the `scenes` golden draws first person at 160 × 100, so a library map's fp reads there differ).

**Map reads.** A map declares what its frames must keep as data, `reads` on the map (`MapPlan.reads`, `MapReads`: `{
minEdge?, hot? }`; world/types.ts), over the defaults `MAP_READS` (view/view-frame.ts: `minEdge` 1.1, `hot` false). A frame
passes (`frameIssues`) when every figure's edge is at least `minEdge` (a figure's read is never under its edge, so the read
is held too) and, unless the map declares `hot: true`, no figure is hot (brighter than its ring by more than 1.1×). It names
what fails: `figure 2: edge 0.99 < 1.1`, `figure 1: hot 1.77 > 1.1`. A declaring map must show a figure in each view.
- **One walk holds them all** (`tests/base/readability.test.ts`): the base scenes, `maps.json`'s keys, `apartment@1` and
  `block@1`, each declaring map in both views. The base scenes always declare; so do `bedroom` (since cycle 7), `neonBar`,
  `forestClearing` and `signs` (`{}`). A map declares once it passes. The rest are **unchecked** and listed (`it.todo`, and
  `npm run check`): `streetNight` (its time-0 frame fails `figure 2: edge 0.93 < 1.1` and so do all twelve of
  its frames over time; see the streetNight finding below), and the generated `apartment@1` and `block@1`,
  which cannot carry a declaration in `maps.json` (both pass at time 0 at the cycle-7 values: a generator change would
  declare them; `block@1` only at `exposeHot` 1.09–1.1).
- `npm run render` prints `  reads: ok`, the issues (`diorama figure 2: edge 0.92 < 1.1`) or `  reads: unchecked` under each map.
- **A waiver is shown, not hidden** (`frameWaivers`, view/view-frame.ts: each figure `hot: true` lets through): a frame that
  passes by one is `ok` with it beside the `ok`. `render` prints `  reads: ok (waived: fp figure 1: hot 1.70 > 1.1; …)`, `npm run
  check` prints `  ok        <frame>  waived: figure 1: hot 1.70 > 1.1` and counts them (`39 ok (4 waived), …`), and
  `tune-light`'s verdict is `ok (waived: 4 hot)`. No base scene waives since cycle 7 (`check` counts `41 ok, 0 fail,
  3 unchecked`); the waiver stays for a fork's own measured conflict.

**The hot finding, and how exposure resolved it (cycle 7).** Cycle 6 left the base interiors' near figures hot
(`base-interior/fp` 1.70, `base-interior-dressed/fp` 1.74 of their rings by luma) and waived the hot rule on them: no
global figure light cooled the man and kept the woman's edge at 1.1, as the two stand under one pendant and differ in
albedo. Cycle 7's per-figure exposure (Figures, above) is the lever, and the waiver goes. What was measured:
- **A real conflict at the old light** (`ambient` 1.5, `floor` 0.5, `threshold` 0.22): `base-interior-dressed/fp`'s man, at
  his ring × 1.1, would have an edge of about 1.05; in light steps his trials jump from edge 1.33 / hot 1.40 straight to
  edge 1.09 / hot 1.14, so no step satisfies both. `base-interior/fp`'s is a knife edge (edge 1.11, hot 1.11). `rim`
  changes nothing.
- **`threshold` 0.07 resolves it.** More form steps give the figure more internal edge: with exposure on, `threshold`
  0–0.1 passes every declaring frame, and 0.11 fails (`base-interior/fp figure 1: hot 1.17`). The price: the interiors' near
  faces and arms are mottled with lighter patches.
- **`ambient` 2.6 and `floor` 0.8 bring bedroom to 1.1 and over** (bedroom's figures were dark, hot 0.36–0.97, so
  exposure alone could not help; raising the figure light brightens them and exposure cools any figure that then runs
  hot). **The owner chose `ambient` 2.5 over the plan's 4** (2026-11-10), because at 4 the flat light clips at `light.max`
  on all three channels at `day` and `golden`: the figures lose the time's tint. **Then 2.6 over 2.5** (2026-11-10, the
  implementation audit's H1): at 2.5 one frame fails over time (below). Every declaring frame passes at 2.6.
- **The passing runs** (one key moved at a time, the rest at the values, `npm run tune-light -- --maps all <key>=…`, the
  declaring frames at t = 0: the base scenes, bedroom, neonBar, forestClearing, signs). A run's ends are the values tried;
  where a value fails, it is named with its first failure:
  - `ambient` 2.4–6 (2.3 and 2.2 fail: `bedroom/fp` figure 1 `edge 1.09 < 1.1`; the run's foot is between 2.3 and 2.4, and
    `tests/scripts/lit-rooms.test.ts` pins it); tried 2.4, 2.5, 2.6, 2.7, 2.8, 3, 4, 5, 6.
  - `floor` 0.3–2 (0.2 fails: `base-interior-dressed/fp` figure 1 `hot 1.13`, figure 2 `edge 0.97`; the foot is between 0.2
    and 0.3); tried 0.3, 0.4, 0.6, 0.8, 1, 1.2, 1.5, 2.
  - `threshold` 0–0.1 (0.11 fails: `base-interior/fp` figure 1 `hot 1.17`, `base-interior-dressed/fp` figure 1 `hot 1.20`; so
    does 0.12); tried 0, 0.04, 0.05, 0.07, 0.08, 0.09, 0.1.
  - `exposeHot` 1.0–1.1 (1.12 fails: `base-interior-dressed/diorama` figure 2 `hot 1.11`, as the judge's limit is 1.1);
    tried 1, 1.04, 1.06, 1.08, 1.1.
  - `rim` 0–1 (tried 0, 0.2, 0.35, 0.5, 0.7, 0.8, 1) and `floorCap` 0.6–2 (tried 0.6, 0.7, 0.8, 1, 1.2, 1.5, 2): none fails.
- **At the values** (`expose` on, `exposeHot` 1.1, `threshold` 0.07, `ambient` 2.6, `floor` 0.8): over the declaring
  frames at t = 0 the weakest edge is 1.137 (`base-interior-dressed/fp`, figure 1) and the hottest figure 1.097 of its ring
  (`base-exterior/diorama`, figure 1). **Both sit near 1.1 by construction, not by margin.** Exposure stops each figure at
  the last whole step under 1.1× its ring, and in a dry frame the trial is the frame, so the hottest cannot be above 1.1;
  and the weakest edge is the edge of the step exposure picked. Under every passing one-key move above the weakest edge is
  1.112–1.220 (1.112 at `floorCap` 1.5 and 2, 1.113 at `floorCap` 1, 1.114 at `exposeHot` 1.0, 1.119 at `rim` 0), so a wider
  margin would need a different rule (for example exposure that stops lower than 1.1×; `exposeHot` 1.0 leaves the weakest at
  1.114). No base scene waives the hot rule.
- **Over time** (every declaring frame at t = 0, 1/12, … 11/12: 8 maps × 2 views × 12 = 192 frames, each room drawn at its
  time and relit; a throwaway script, not kept): `check`, `tune-light` and the walk judge t = 0 only, so this is the one
  measure of the rest.
  - **At 2.6, all 192 pass:** the weakest edge 1.110 (`base-interior-dressed/fp`, t = 8/12), the hottest 1.100
    (`base-exterior-dressed/diorama`, t = 6/12). At 3 the same.
  - **At 2.5, 191 pass.** `base-interior-dressed/fp` at t = 8/12 fails `figure 1: hot 1.24 > 1.1` (edge 1.32): the clamp
    conflict (above) coming back, as the largest step that is not hot has an edge under 1.1 and the clamp takes the man
    up to one that is. 2.4 fails it too. That is why the look is 2.6.
  - That frame is pinned in `tests/base/readability.test.ts` (`base-interior-dressed/fp at t = 8/12`): it passes at 2.6 and
    fails at 2.5.
- **streetNight is not declared, and its conflict is reported.** Its second figure's edge is under 1.1 in the frame, and
  exposure cannot raise an edge (it only cools).
  - **At 2.6** (its 12 diorama frames read the same at 2.5) its time-0 diorama fails `figure 2: edge 0.93 <
    1.1` and its first person passes; over twelve frames (t = k/12) **12 of 12** dioramas fail, on edges 0.79–1.09 and, at t =
    1, 2 and 6, on hot 1.14–1.25.
  - **The rain is not the whole cause.** At t = 0 and 2.6, figure 2's edge is 0.93 in the frame, 0.96 with `rain` off, 1.04
    with `rain`, `bloom`, `particles`, `shafts` and `grade` off, and 1.39 with `reflect` off as well (then the frame
    passes). So the post passes, the reflection above all, account for it, not a figure too dim to read. Exposure's trial
    lights a figure alone on the room before the post passes, so none of these can move its step.
  - **At ambient 4** (the plan's value) it passed at t = 0 and failed 7 of its first 12 dioramas (edge 0.79–1.08, or hot
    1.14–1.20); it was not declared for that reason, and at 2.5 and 2.6 the reason is the one above.
  - `npm run render`, `check` and the walk list it `unchecked`. A later cycle could brighten its figures by data (a map-level
    lamp or grade), or measure the trial after the post passes (a design change).
- **Other times of day** (`npm run lit -- out/lit`): `lit` prints each frame's `readLine` and, under it, what fails
  `frameIssues` (`not judged: …`). What the sheet shows is below.

**What the lit sheet shows** (`ambient` 2.6; the base interior and exterior at each time of `times.json`, read by the same lines):
- **The exteriors are never hot** and read at every time (edge 2.0–5.4). At `day` and `golden` the figures keep the time's
  tint: pale grey-blue tops and warm skin at `day`, brown and orange at `golden`, nothing clipped to white (at the plan's
  `ambient` 4 the flat light clipped to `light.max` on all three channels, so day figures bleached and golden ones went
  grey; 2.6 does not).
- **base-interior's first person stays hot at `dusk`, `night` and `bar`**, held there by the edge clamp (their edges are
  1.13–1.31: scaling them further down would take an edge under 1.1). The hot ratios, which `lit` prints (the figures'
  `not judged:` lines; `L` in the read line is luma either way round and is not the hot ratio): `dusk` figure 1 **1.15**;
  `night` figures 1 and 2 **1.22** and **1.19**; `bar` **1.32** and **1.28**. Before exposure the interior read 1.68–1.97 at
  those times. No test or `check` covers them, `lit` reports them; `lampLit` (the base's time), `day` and `golden` pass.
  The diorama passes at every time.
- **`threshold` 0.07 mottles the interiors' near faces and arms** with lighter patches, the price of the resolution (more
  form steps give the figure the internal edge the clamp needs).

**Tuning the figure light.** `npm run tune-light -- [<key>=<v1>,<v2>,…]… [--map <id>]… [--maps all]` re-draws every base scene
(bare and dressed, diorama and first person) at each combination of trial values for any numeric `figureLight` key
(`ambient`, `threshold`, `ink`, `floor`, `rim`, `floorCap`, `exposeHot`), and prints a `readLine` for each frame, then, over
every frame drawn, the weakest (the lowest edge) and the hottest (the highest figure luma over ring luma), each with its
frame and figure, and a verdict judged by what each map declares: `ok` where every frame passes its map's reads, else
`fails: ` and every issue as `<frame> <issue>`. The last lines are `passes:`, the passing combinations, and `drawn:`.
- **`--map <id>`** adds a map's frames, and they are judged like the base frames: by the map's `reads`, or by the defaults
  (`MAP_READS`: edge at least 1.1, none hot) where it declares none, so a map is brought to pass before it declares.
- **`--maps all`** adds every checked map that declares `reads` (`mapsOf`, `scripts/lit-rooms.ts`) and prints
  `unchecked: <ids>` for the rest.
- **A map comes to declare** by `--find` (below) until it passes at the figure light, then `reads: {}` in its data.

It never writes `look.json` (a value is chosen by these lines, then copied in by hand): it sets the values for the frames of
one combination with `withFigureLight` (`paint/look.ts`), which restores them even if the draw throws.

**Rooms.** Each frame is a room and its figures (`drawRoom`, `drawFigures`; render.ts, fp.ts): the room is everything the
figure light does not touch, the scene shaded with each figure placed and its shadow cast from its unlit cell; the figures
are lit as sprites, composited on a copy of the room, and post-passed. `roomOf` (view/view-frame.ts) draws a room once and
`relight()` draws its figures at the light as it is now, so `tune-light` draws every room once (about 10–13 s for the eight
base frames) and a combination takes **0.1–0.2 s** (it was 18 s). A relight keeps nothing of the last light: a room relit at
one light, another, then the first again is byte for byte what a fresh frame is at each (`tests/features/view/room.test.ts`),
and `viewFrame` is `roomOf(…).relight()`, so the board, `render`, the goldens, the walk and `tune-light` draw a frame by one
path. `tune-light` prints how long the rooms and the combinations took on its last line.

```
npm run tune-light -- floor=0.3,0.5
#1 floor=0.3
  base-interior/diorama  1.24 (E 1.24, L 1.12)  1.26 (E 1.21, L 1.26)
  base-interior/fp  1.15 (E 1.14, L 1.15) hot  1.17 (E 1.17, L 1.01)
  …
  base-interior-dressed/fp  1.18 (E 1.12, L 1.18) hot  1.15 (E 0.99, L 1.15) < 1.1
  …
  weakest 0.99 (base-interior-dressed/fp, figure 2)
  hottest 1.18 (base-interior-dressed/fp, figure 1)
  fails: base-interior-dressed/fp figure 2: edge 0.99 < 1.1
#2 floor=0.5
  …
  weakest 1.27 (base-interior-dressed/fp, figure 2)
  hottest 1.77 (base-interior-dressed/fp, figure 1)
  ok
passes: #2
drawn: rooms 10.2 s once, 0.2 s a combination
```

**`--find key=lo..hi[:steps]`** searches one numeric key (`steps` 10 by default, the values as `npm run tune --find`'s) over
the base rooms: a line a value, `*` on the passing value nearest the look's own, then where it passes. A value passes when
every base frame passes what its scene declares. It never writes `look.json`, and takes no other `key=values`:

```
npm run tune-light -- --find floor=0.3..0.6:2
#1 floor=0.3   weakest 0.99 (base-interior-dressed/fp, figure 2)  hottest 1.18 (base-interior-dressed/fp, figure 1)  fails: base-interior-dressed/fp figure 2: edge 0.99 < 1.1
#2 floor=0.45  weakest 1.29 (base-interior-dressed/fp, figure 2)  hottest 1.55 (base-interior-dressed/fp, figure 1)  ok  *
#3 floor=0.6   weakest 1.49 (base-interior-dressed/fp, figure 2)  hottest 1.95 (base-interior-dressed/fp, figure 1)  ok
passes: 0.45..0.6
nearest the current (0.5): 0.45
drawn: rooms 10.2 s once, 0.2 s a combination
```

Over `floor` 0.2–0.6 (the walls as Cycle 6 left them): 0.2, 0.25, 0.3 and 0.35 fail on the dressed interior's second figure (the
weakest edge 0.68, 0.82, 0.99, 0.99), 0.4 passes by under 0.01 (1.10: never a test value), and 0.45 and over pass. The
exteriors' figures are never hot at any `floor` from 0.2 to 0.6 (they are darker than their rings).

**`npm run check`** runs every declared check in one table and one exit code, in about 20 s on 4 cores (a map a worker process, `scripts/pool.ts`; it prints `checked in <n> workers, <s> s`) and with no goldens: every
declaring swatch (`photos.md`), every declaring map's reads (the walk above), and the architecture test, with the unchecked
maps listed. Run it before a commit with `npm run typecheck` and `npm test`.

The floor cap's 0.8 was chosen this way: the base frames' reads are the same at every cap from none down to 0.7, and
they start to drop below it; 0.8 brings the neonBar man to his room's luma while he still reads by edge.

## What was removed

The painter's key bands and their clusters, the tone steps along a ramp by lamp rings, the grade tint, the contact-shadow,
screen-space AO and halo passes, `Lamp.steps`, `radius` and `tint`, `TimeOfDay.form`, `exposure`, `tint`, `figureLift`,
`haze` and `heightFog`, `SceneMaterial.form` and `grain`, and the `Refine` switches (now `look.json`'s `switches`).
