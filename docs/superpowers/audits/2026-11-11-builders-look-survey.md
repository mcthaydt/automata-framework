# The builders' look and figures in the framework: the survey

**Date:** 2026-11-11. **Stage:** 2 (plan), part 1. **Spec:**
[`../specs/2026-11-11-builders-look-and-figures-design.md`](../specs/2026-11-11-builders-look-and-figures-design.md),
"Survey first". **Plan:** [`../plans/2026-11-11-builders-look.md`](../plans/2026-11-11-builders-look.md).
**Tracker:** [`../progress.md`](../progress.md), workstream 4.

Everything here was measured in this session, not taken from the record. Where the record and the measurement
disagree, the measurement is given and the record's line is named.

## What was read and run

| Thing | At | How |
|---|---|---|
| The framework | `main` `6a70f9b1` (the sheets were shot at `32b90536`; the commits between are documents only) | `pnpm install`, `pnpm --filter @af-examples/examples-3d build`, headless Chromium on software WebGL (`--use-angle=swiftshader --enable-unsafe-swiftshader`) |
| EnvironmentBuilder | `main` `f7c5356`, its own FigureBuilder submodule at `50235f4` | `npm ci`, `npm run render -- <dir>`: 22 frames, the 8 base ones used |
| FigureBuilder | `main` `23f889c` for its frames; `d6e3c9f` (the framework's pin) placed in `vendor/FigureBuilder`, nothing committed from it | `DENSITY=2 npm run render -- <dir>`, `npm run lit -- <dir>/lit` |
| The draft pull requests | the heads named in "The draft pull requests" below | `git merge-tree` against `main`, then each merge checked in a scratch worktree |

Not run: WebGPU, WebKit, Firefox, a real GPU (the spec's non-goals until a runner exists); the 2D and 3D browser
suites and the journeys on `main` (the survey's own pictures and the examples' build stand in for them here).

## The sheets

In [`builders-look-survey/`](builders-look-survey/), made by [`shoot.mjs`](builders-look-survey/shoot.mjs) there,
which drives the page of `spikes/eb-look` as it is on `main`. [`shots.json`](builders-look-survey/shots.json) holds
each panel's two numbers: its mean brightness (the mean of red, green and blue over the field, 0 to 255) and its
count of distinct colours.

Each scene sheet has three panels: EnvironmentBuilder's CPU frame; the framework with the level's baked room light
(`worldLighting(world, time)` as `lighting`, how a game lights a level today); the framework with the bake left out,
so each piece keeps the ramp material and is lit by the time of day. The figures in the framework's panels are the
base pair as core's `figure` draws them (meshes), because that is what a level's cast gets today; the kit's painted
figures are on their own sheet. The builders draw the diorama and first person only, so the gameplay sheets have no
builder panel.

| Scene (its time) | Diorama | First person | Gameplay camera (50 mm, 30°, 16 m) |
|---|---|---|---|
| base-interior (`lampLit`) | [sheet](builders-look-survey/base-interior-diorama.png) | [sheet](builders-look-survey/base-interior-fp.png) | [sheet](builders-look-survey/base-interior-gameplay.png) |
| base-interior-dressed | [sheet](builders-look-survey/base-interior-dressed-diorama.png) | [sheet](builders-look-survey/base-interior-dressed-fp.png) | [sheet](builders-look-survey/base-interior-dressed-gameplay.png) |
| base-exterior (`day`) | [sheet](builders-look-survey/base-exterior-diorama.png) | [sheet](builders-look-survey/base-exterior-fp.png) | [sheet](builders-look-survey/base-exterior-gameplay.png) |
| base-exterior-dressed | [sheet](builders-look-survey/base-exterior-dressed-diorama.png) | [sheet](builders-look-survey/base-exterior-dressed-fp.png) | [sheet](builders-look-survey/base-exterior-dressed-gameplay.png) |

Figures: FigureBuilder's base pair in 8 views at density 2
([man](builders-look-survey/figures-fb-base-m.png), [woman](builders-look-survey/figures-fb-base-f.png)), its
[lit sheet](builders-look-survey/figures-fb-lit.png), and the kit's painted figures on `main`
([`characterkit-painted`](builders-look-survey/figures-af-painted.png)).

### The numbers

Mean brightness, then colours. The framework's panels include the letterbox bars (about 5% of the field), so read
the ratios, not the last digit.

| Sheet | EnvironmentBuilder | Framework, baked | Framework, material only |
|---|---|---|---|
| base-interior, diorama | 50.8, 53 | 15.7, 23 | 41.4, 30 |
| base-interior, first person | 47.8, 47 | 22.2, 20 | 40.1, 27 |
| base-interior-dressed, diorama | 50.7, 72 | 22.2, 38 | 42.2, 37 |
| base-interior-dressed, first person | 48.2, 63 | 24.0, 29 | 37.3, 36 |
| base-exterior, diorama | 123.2, 121 | 35.4, 35 | 38.4, 49 |
| base-exterior, first person | 129.3, 93 | 92.1, 51 | 93.5, 59 |
| base-exterior-dressed, diorama | 121.5, 141 | 36.4, 53 | 39.9, 59 |
| base-exterior-dressed, first person | 128.6, 96 | 91.9, 54 | 93.5, 60 |
| base-interior, gameplay | none | 36.7, 20 | 44.8, 31 |
| base-interior-dressed, gameplay | none | 39.0, 40 | 46.1, 40 |
| base-exterior, gameplay | none | 36.1, 45 | 38.5, 54 |
| base-exterior-dressed, gameplay | none | 35.9, 65 | 38.9, 63 |

The baked interior is 0.31 to 0.50 of the builder's brightness and the baked street 0.29 of it. The first-person
street is closer only because the sky fills half the frame.

### Each difference, named

1. **The baked room is near black.** Interior walls, floor and ceiling under the pendant draw at a third of the
   builder's brightness; the ceiling is black. The street by day is as dark. The cause is known and is not the light:
   a baked piece is a `FlatMaterial`, which skips tone mapping and with it the display encode, while the bake writes
   its light as a linear multiplier and the tile's texture is decoded to linear, so the screen shows
   `(albedo × light)` to the power 2.2. The diagnosis and a fix are in #590 (`docs/refactor/eb-look/dark-interior.md`
   and the commit "a baked room shows albedo × light, not its 2.2 power" there). The record on `main` says so in one
   line ("the baked WebGL room is still dark as before") and nothing tests it in a browser.
2. **The material-lit street is as dark as the baked one** (38.4 against 123.2). Not a pass: with the bake and the
   look both off the frame reads 42.5. The ramp material under `day` does not reach
   the builder's sunlit pavement. The builder lights scenery with its baked term only, so the bake is the path to
   fix; the material path is what a game without `lighting` gets and stays as it is.
3. **No lamp glow.** The pendant's bulb and shade are a lit orange surface; the builder's bulb glows at its own step
   with a ring round it. In #589.
4. **Windows are flat blue.** The builder's panes carry reflection streaks by day and show the room behind at
   night. In #589.
5. **No pool of light that reads.** The builder's pendant lays a warm pool on the tiled floor; the framework's baked
   floor shows a small orange patch at the figures' feet and black beyond, the same power-2.2 fault.
6. **No figure shadows.** The builder's figures cast a sun shadow on the pavement (strength 0.6); the framework's
   cast none. Not started anywhere.
7. **Figures.** In a level the cast are core meshes: flat orange and red under the bake (one tint), black
   silhouettes on the baked street, grey under the material. The builder's are painted, lit as sprites with a warm
   flat light and a rim. The kit's painted figures on `main` equal the builder's cells (the figures sheet) but are
   unlit, and no level puts them in a room: the join is #607.
8. **The dollhouse cut.** The builder's diorama cuts the near wall and shows the room's side walls; the framework's
   occluder rule hides the near wall and the ceiling and insets the room. A framing difference, not the look.
9. **The gameplay picture is small.** At 16 m the 6 × 5 m base room fills a quarter of the field. #589 gives each
   base room a view at the distance that frames it.
10. **A green veil off the room.** Outside the room's walls the gameplay and diorama frames show the haze colour
    where the builder shows the sky's bands or nothing. Named for the light tasks to look at; it may be right.
11. **What already matches:** the sky's bands, clouds and the city horizon in first person; the tiles on walls, floor
    and road (material panel); the dresser's furniture, sign and props; the camera's lens and tilt.

A WebGL warning appears on `main` whenever the look is on: "GL_INVALID_OPERATION: glDrawElements: Feedback loop
formed between Framebuffer and active Texture." It is a warning, not an error, so `shots.json` does not list it. Its
fix is the colour-only present pass of #602, which is not on `main` and is carried by #588, #589, #590 and #607.

## The two examples that draw almost nothing

Built with `pnpm --filter @af-examples/examples-3d build` and looked at, then each cause isolated by switching one
thing at a time on a scratch page.

### `examples/3d/world/world-level-room.ts`: a black frame with only the figure

**Cause: the example's level is not a valid level, and the example throws the problems away.** Its inline
`af-sector/2` room has no `floor` and no `light` on the sector. `readLevel(room)` returns an empty level and two
problems (`sectors[0].floor`: invalid input; `sectors[0].light`: expected number, received undefined). The example
passes `readLevel(room).level` straight to `buildWorld` and never reads `.problems`, so `buildWorld` gets no sector
and returns 0 pieces and 0 problems. Measured: `PIECES 0`; the frame is as black with the look off (brightness 4.6
either way), so no pass and no light is involved.

It is not the lit-room path. It went unseen because the example's journey counts only Wick's blue pixels and "more
than 8 colours", which the figure alone gives.

### `examples/3d/look/look-pixel-art.ts`: near black

**Cause: its fog ends before the camera's distance.** The example sets `fog: { near: 5, far: 14 }` and takes
`cameraView('follow')` at its defaults, which changed on 2026-11-11 from 5 m to 16 m. Everything is now past the
fog's far edge and draws in the fog's colour, and the figure is 16 m away and a few pixels tall. Measured: brightness
19.7 to 32.3 as it is; 48.5 with the fog at 16 to 30 m, the floor its own colour and the figure readable; 44.4 with
no fog. The same change broke `characterkit-painted` on 2026-11-11 and was fixed there by stating the camera's
distance in the example.

Both examples are cut with Ember Hall when the prologue plays (the Owner's decision). Until then the plan repairs
them in a few lines each and, more to the point, adds the guard each fault shows is missing: a level that fails to
read must not draw as an empty room in silence.

## Work packages and figure pieces

"Working" means it draws on `main` in WebGL in the sheets above or in the examples' build. Tests named are on
`main`.

| Piece | State on `main` | Evidence |
|---|---|---|
| WP0 gameplay camera (50 mm, 30°, 16 m, eight steps, dolly, peek) | On `main` and working | `features/camera/play-camera.ts`; the gameplay sheets. It broke two examples that leaned on the old defaults (`look-pixel-art`, above; `characterkit-painted`, fixed) |
| WP0 (the record's second use of the number): Pixi 3D on WebGPU | On `main` in part; the rest in drafts | The integer-uniform fix is on `main`. The frame-invalid-after-a-mesh fault is fixed by #602's present pass, not on `main`. Not run here |
| WP1 WebGPU on a real GPU | Not started | No runner; the spec's non-goal for now |
| WP2 sun, key, fill, steps in the bake | On `main` and broken on screen | The bake's numbers are right (unit tests in `tests/unit/shared/render/light/`); the screen shows them to the power 2.2 (difference 1). Fix in #590 |
| WP3 subdivide and occluders | On `main` and working | `features/world/{subdivide,occluders}.ts`; 44 pieces cut in the base interior. A wall's openings do not let light through: that is in #589 |
| WP4 haze | On `main` and working | `features/look/haze.ts`; the first-person street fades to the horizon |
| WP5 sky and horizon | On `main` and working | `features/look/sky-pass.ts`; the first-person exterior sheets match the builder's bands, clouds and city. The app must aim it; the renderer does not |
| WP6 albedo as palette indices | On `main` and working | `features/world/albedo/ladder.ts`; the material panels |
| WP7 photo tiles | On `main` and working | world kit's `albedo-tiles`; walls, floors and road are tiled in every sheet |
| WP8 the dresser's placements | On `main` and working | The dressed sheets place the builder's furniture and props |
| WP9 glow and windows | In a draft: #589 | Differences 3 and 4 |
| WP10 outline's colour rule, shafts, reflections, mood grade, particles | In a draft: #590 | None shows in a day base frame; #590 checks them in browser tests |
| Sprite light | In a draft: #607 | Core's `features/look/sprite-light.ts` is on `main`, tested, and called by nothing; #607 lights the painted cell with the builder's `lightSprite` instead |
| Rim | In a draft: #607 | The builder's rim rule, with its ruling recorded there |
| Exposure toward the ring | Not started | The builder's `view/expose.ts` has no counterpart; #607 holds a figure at or under its painted cell, which is a different rule |
| Depth per texel | On `main` and working in WebGL; WebGPU in #607 | The kit's `painted-depth` browser test; `characterkit-painted` draws both figures (figures sheet) |
| Cast shadow | Not started | Difference 6 |
| Faces (drawn moods) | Not started | Planned in FigureBuilder's wardrobe cycle and not begun there |
| Wardrobe | On `main` in part; more in FigureBuilder #29 | The runway wardrobe (nine garment kinds, twelve hair styles) is in the kit. A ward uniform's cap, tabard, hosiery and boots, front hair and a bob are half built in FigureBuilder #29 and not begun in the kit |
| Painted figures in a level's room | Not started on `main`; #607 has the light, nothing has the cast | A level's `cast` draws core meshes. Nothing takes a level's cast to `paintedFigure` |

## The draft pull requests

All five framework drafts were cut from `main` at `5d7f40d3` (the merge of #595) and `main` has since gained
documents only, so every one merges with `main` with no textual conflict (`git merge-tree --write-tree`, exit 0
for each). #590 contains #588 and #589 whole; #607 contains #603 whole. All four code branches also carry the same
seven commits that are not on `main`: the colour-only present pass (#602) and its WebGL follow-up, the journeys'
free ports (#604), the submodule reset in CI (#601) and three test fixes (#587).

`main` at `6a70f9b1` did not pass `pnpm check`, for reasons that were not this workstream's, so each step was run
on its own on `main` and on each merge. `main` at `f93a2402` has since made `docs/superpowers/` a record folder:
`style` and `source-names` were re-run there with this survey and the plan in the tree, and both report 0 findings.

| Step, run alone | `main` `6a70f9b1` | #607 merged | #590 merged | #589 merged | #588 merged | #603 merged |
|---|---|---|---|---|---|---|
| `lint` | 0 | 0 | 0 | not run | not run | not run |
| `typecheck` | 0 | 0 | 0 | not run | not run | not run |
| `boundaries` | 0 | 0 | 0 | not run | not run | not run |
| `style` | **1**: 10 findings | **1**: 10 findings | **1**: 10 findings | not run | not run | not run |
| `source-names` | **1**: 170 findings | **1**: 170 findings | **1**: 170 findings | not run | not run | not run |
| `knip` | 0 | 0 | 0 | not run | not run | not run |
| unit tests, every package (`turbo run test:unit --continue`) | **1**: 60 of 61 packages pass; failed: `@automata/repo-hygiene` | **1**: 60 of 61 packages pass; failed: `@automata/repo-hygiene` | not run | not run | not run | not run |
| `check:changesets` | 0 | 0 | not run | not run | not run | not run |

A cell reads the step's exit code. `main`'s three failures are documents under `docs/superpowers/` and belong to
no draft: a merge that shows the same counts as `main` adds none of its own. "Not run" means the step had not
finished when this was written; the plan's first task on each branch runs every step again as its baseline.


### The rulings

| Pull request | Head | Its own commits, code changed | What it holds | Ruling | Reason |
|---|---|---|---|---|---|
| #589 `claude/eb-look-glow` | `0024f81a` | 18 commits; 53 code files, +1687 −314 | Glowing swatches at their own step, dimming with their lamp; a lit window showing the room behind its glass; the light's occluders cut at a wall's openings; static props baked and re-baked when moved; bloom as rings round what glows (world kit); a camera view for each base room at the distance that frames it; the shared fixes above | **Merge**, first | It changes no golden. The dark-room fix cannot land without it: cherry-picked onto `main` alone, the fix conflicts in four files; on top of #589 it applies cleanly. Measured on that trial state: the baked interior diorama reads 44.3 against the builder's 50.8 (it is 15.7 on `main`), first person 48.5 against 47.8; the street's diorama 90.0 against 123.2, so the street is still about a quarter darker and the plan diagnoses it |
| #590 `claude/eb-look-effects` | `22b63b54` | 48 commits, 12 of them code of its own beyond #589 and #588; 151 code files in all, +7904 −407 | The dark-room fix and its diagnosis; the outline in the near shape's own deep step; the mood grade before the snap; shafts, wet-ground reflections and particles (world kit), each with a switch; all of #588 | **Finish, then merge**, third | The fix is taken out of it early by cherry-pick (`680bbc31a`). The rest merges after the figures with one conflict, in a spike file. To finish: a test that every pass is off behind its switch and the day sheets unmoved, and the ruling on #588's room-visibility below |
| #588 `claude/tll-extensions-1` | `8e348d9a` | 19 commits; 97 code files, +4650 −264 | Three extensions with examples and journeys: `lcd-panel`, `retro-crisp`, `room-visibility`; two seams in core: a look pass may run before the snap, and an opt-in whole-pixel scale for the letterbox (`@automata/framework`, with a changeset) | **Finish through #590; close #588 itself as carried by it** | It is contained whole in #590, so it needs no merge of its own. `lcd-panel` and `retro-crisp` are opt-in looks in their own packages and the two seams are generic, so they land. `room-visibility` answers the question workstream 2 answers in `@automata/3d` ("the rooms a view draws"), and the Owner's decisions list #588's clinic work as superseded by workstream 2, so it is removed before #590 merges. This is a call for the coordinator |
| #607 `claude/c8-lit` | `7167af1f` | 22 commits; 55 code files, +2463 −399 | Painted figures lit by their room (a flat light, one step of form, a rim, never above the painted cell); depth per texel on WebGPU; the kit's lit-cell cache and bench; FigureBuilder's pin from `d6e3c9f` to `23f889c`; the runway golden re-recorded (42 of 112 cells) with the arch override deleted | **Merge**, second | Specified, audited twice and fixed in its own cycle, with 0 pixels against the builder's `compose`. It is the only draft that moves a golden: one commit, named, ruled on by that cycle's coordinator (FigureBuilder's hair-pole rule, which made the painter the same on every machine). That ruling is carried forward, not re-made here; the plan checks it is the only golden that moves |
| #603 `claude/c8-lit-spec` | `70cc66c4` | 2 commits, documents only | The spec, plan and plan audit of #607 | **Close as carried by #607** | Contained whole in #607; it shows as merged when #607's branch lands |
| FigureBuilder #29 `claude/c9-wardrobe` | `856498a` | 10 commits; 37 files, +2501 −29 | A spec, an audited plan, and six of its ten FigureBuilder tasks: sheer cloth, the shod foot, the head's form, hair in front of the shoulders, hair that rests on the trunk, a fringe and three styles; a checkpoint's sheets. Not built: glyphs, drawn moods, the wardrobe golden and the merge; nothing of its framework half | **Finish**, cut to the ward | The prologue's figures need a ward uniform, street clothes and moods; they do not need glyphs. Its remaining work is in FigureBuilder's repository, then the kit |
| #575, #596, #606 | | | The clinic drafts | References only | Superseded by workstream 2 (the Owner) |

Two open pull requests outside the list matter to it: #602 (the colour-only present pass) and #587 (the browser
suites under the new camera) are not drafts and are not on `main`; every code draft above carries both, so they
land with the first merge and can then be closed as carried.


## Remainders the drafts name themselves

Read from each draft's own "not done" list; none is hidden by a pass. The plan carries each to its last task, where
it is fixed, accepted with the Owner's word, or left open by name.

| Remainder | From |
|---|---|
| Patterns (stripes, checker, noise, grass, leaves, glass) and grime marks are not swatch ladders; a map's grime does not scale a tile's wear | The record of the albedo work on `main` |
| A room's `light` field is read as whole 0.85 steps darker; no base scene uses it | The record, "open for the Owner" |
| A window's room is a tile seen at a fixed angle; it does not move as the camera turns | #589 |
| The bloom's mask is a colour match, so a lit surface that lands on a glow colour would ring too | #589 |
| A closed hinged door does not stop a lamp in the next room | #589 |
| Reflections, particles and the mood grade show in no base frame (no rain, no emitter, no mood in the base scenes) | #590 |
| The worst frame when several lit figures relight at once (4.9 to 43.6 ms between runs; the medians hold 2 ms) | #607, ruled a known risk there |
| A figure's cast shadow; exposure by trial; glyphs | This survey |

## What this means for the plan

1. **The lit room.** The fault is one known cause with a fix already written and unit-tested in #590. What is
   missing is the browser test that would have caught it and a guard on a level that fails to read.
2. **Light.** The bake's term is on `main`. After the fix it needs its measure against the builder's frame, the
   openings from #589 and a figure's cast shadow.
3. **Figures.** #607 is the work; it needs the present pass on `main` first, and then a level's cast drawn as
   painted figures, which nobody has started.
4. **Glow and effects.** #589 then the rest of #590, each behind its switch.
5. **Wardrobe.** FigureBuilder #29 is half done and its framework half has not begun.
