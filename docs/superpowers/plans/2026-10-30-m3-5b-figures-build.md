# M3.5b: figures part 2 (part and garment generators, `build()`), TDD plan

- **Spec:** [M3 spec, revised three times](../specs/2026-10-18-m3-3d-characters-design.md), as amended 2026-10-30 (M3.0A, PR #195): §4.4.1 (the source, what is not extracted, palette materials, the fixed ppm, `hairPieces`), §13 F-d.
- **Task:** `M3.5b — figures part 2: part and garment generators, build()` (02). Lane **figures**; prerequisite M3.5a (PR #202, not merged: this branch stacks on `claude/3d-m3-5a-figures-rig` at `00868bd`, and merges `origin/main` once #202 lands, never a rebase). Size L.
- **Status:** drafted 2026-10-30.
- **Progress:** 0 of 9 steps.

## Sources (read-only, recorded in every extracted file's header)

| Source | Commit | Taken |
|---|---|---|
| FigureBuilder, `mcthaydt/FigureBuilder` | `a1f7246` | `src/render/figure/parts.ts` (the primitives, skin weights, `reach`, `placed`), `garments.ts` (the body, the head and ears, hands and shoes, the classic garments, locks, the face's point marks, `dress`), `hair.ts` (the skull, `sweep`, the shell, every hair piece, the tail, caps and `underCap`), `streetwear.ts` (the loft, shells and their layering, tops, bottoms, sneakers, the chain's rope, hoops, shades, the registry and `reachable`); from `cast.ts` the item parts (`item`), `random` (mulberry32) and the generic half of `randomCharacter` (sliders, layers, wardrobe draws); from `motion.ts` `Anchor` and `clearance` (what `build()` returns); from `tests/random.test.ts` "the registry in the random cast" |

Not taken (spec §4.4.1 and the 02 row): `paint.ts`, `raster.ts`, `ramp-light.ts`, the DUEL ramps and every painter field (tones, `paint`, `mix`, `stain`, `holo`, `see`, grain, wear); streetwear's graphics, the nameplate and its `pendant` anchor, the font and the colourway (`sets.json`, `onBrand`, `loud`, `apart`, `family`); the sprite densities and the sheets' camera `PITCH`; the drawn face (`FaceLook`, `drawnFace`) and the painter's hand stamps; `boneGroups`, `drapeWeights`, `toSkull`, `backOf`, `recombine`, `rangeCharacters` and `fits` (nothing in `build()` uses them; `fits` is a stand's, M3.5c). Later rows: `motion.ts`'s base pose, stands (`CHAIN`), holds, hems and the hair spring, and FigureBuilder's `tests/form.test.ts` (pocket holds, the walk) are M3.5c; the view is M3.5d.

## Decisions (open to the Owner's veto)

1. **Layout.** Five folders under `packages/figures/src/`, each file one responsibility and under 600 lines after `pnpm format` (110 columns): `parts/` (mesh types, primitives, skin weights, reach, texels), `garments/` (body, head, hands and shoes, face marks, locks, the classic garments, `dress`), `hair/` (skull, sweep, shell, tones, pieces, tail, cap), `streetwear/` (loft, the body under and skinning, tops' shared shapes, layering, each garment family, the registry) and `build/` (`build`, anchors and clearance, items). The modules that reference the registry (`underneath`, `topOf`, `reachable`) only call it inside functions, so the registry's imports of the garment builders form no load-time cycle.
2. **`build()` takes the library.** `build(def, skeleton, outfit, item, library)`: the spec's four arguments plus `FigureLibrary` (`swatches`, `hair`, `headwear`, `items`, keyed by id as compiled content holds them), because figures has no global library (5a: no character or library in code). It is pure: it reads its arguments and writes nothing.
3. **Materials are palette colours.** `Built.materials` maps every material a part or decal names to `{ colour, gloss?, flat?, shade? }`: `colour` the swatch's palette index (5a's swatch), `shade` a tone step for the view (+1 a step lighter, −1 the shadow, −2 the deep: the offsets of the source's four-tone ramp, `[base + 1, base, base − 1, base − 2]`). Where the source makes a painter material from a swatch (`own`, `lighter`, `mark`, `flatTone`, the hair's tones, the ear's bowl, a cap's seam), the part names a variant `<swatch>@<role>` resolved from its swatch: rib and inside are the cloth without its gloss (inside also `shade −1`), stitch and marks `flat` at the tone the source picks, a flap, lapel, band or the hair's lit and crest `shade +1`, the hair's parting `shade −2`, the scalp the skin's `shade −1`; a fade's tiers, which the painter mixes between hair and skin, become the hair's `shade −1` (`fade1`) and the skin's `shade −1` (`fade2`). The skirt's stain and the wide-legs' wash are painter washes and are cut: `fade` leaves the wide-legs garment, as 5a left out the skirt's `stain`.
4. **Fixed ppm.** `FIGURE_PPM = 73.8` texels a metre (FigureBuilder's `PPM`: twice the brand kit's 36.9, the density the source judges its figures at, density 2). `texels(want, least)` rounds to it. Marks the source draws per density take the density-2 form: a `sized` mark is one decal at its size, the trousers' stitching is the tonal line (density 2; the contrast-thread outline from density 3 is cut), laces show under a hem, the chain's rope is its density-2 rope. The tail's cuffs, which the source builds only from 1.5 × PPM, are always built (a mesh has no texel floor).
5. **Decals are anchor points.** `Built.decals` are the source's point marks (`bone`, `at`, `normal`, `material`, `size?`, `when?`, `blink?`, `tag?`): the face's eyes, lids, brows and mouth, buttons, zips, stitches and the chain. M3.5d draws them as quads (spec: face decals are quads shown toward the camera). Prints (graphics, plates) are cut.
6. **`hairPieces`.** The hair an outfit wears stays its `{ hair, style }` garment. A hair garment with no `style` wears the figure's `hairPieces` instead, each style built in order in that garment's colour and under the outfit's cap; so a figure keeps its own hair across outfits, and each outfit says only its colour. A hair garment with a style wears that style alone; an outfit with no hair garment wears no hair. A style-less hair garment on a figure with no `hairPieces` is a content compile error at the garment (`figure.schema.ts`).
7. **`Garment` tightened.** 5a's `Readonly<Record<string, unknown>>` becomes the union of each garment's interface, the schemas typed by them; `hair.style` becomes optional (decision 6) and the wide-legs lose `fade` (decision 3). The source's default swatches take the library's kebab ids (`chrome-dark`, `holo-cyan`, `midsole`, `outsole`, `sole`, `chrome`, `mouth`, `lid`, `brow`, `eye-dark`); the shades' default frame, FigureBuilder's `jetBlack` (a SNEKPRTY crew swatch, not in its library), becomes `black`.
8. **Skin weights as the source.** A skinned vertex carries the source's weights (two or three bones across a joint, a hem's pivot as one more), summing to 1, for linear blend skinning. The spec's "two-bone linear blend" describes the common case; nothing is cut to two.
9. **The chain.** Its rope is the source's marks along the U at density 2, round the nape too; the nameplate, its print, its `pendant` anchor and the drop that grows to keep the plate on one cloth are cut, so the rope hangs at the item's `drop`.
10. **Anchors and clearance.** `Anchor` and `clearance` (FigureBuilder `motion.ts`) come here because `build()` returns them; the stands that resolve against them (`CHAIN`, `place`) are M3.5c's.
11. **Random characters.** `testing/random-character.ts`: `random(seed)` is FigureBuilder's mulberry32 (no `Math.random`); `randomCharacter(seed, library)` draws every slider over the source's ranges (the lookbook's narrower ones), a streetwear outfit layer by layer from the registry with the wardrobe's draws, each swatch field from the library swatches of a kind its role takes (or, where the library has none of those kinds, any swatch with no kind), a skin, a hair style with pieces, a cap three times in ten and an item half the time. The colourway's rules are cut with the colourway.
12. **Goldens from the source.** FigureBuilder `a1f7246` runs on Node 24 (a throwaway copy in the scratchpad with `.ts` import suffixes and JSON import attributes, not committed). `testing/figurebuilder-goldens.json` holds, for six fixture outfits that wear every garment and every hair piece kind, each part's bone or skin, group, vertex and index counts and position and weight sums; the port must match them to 1e-9 (the cut parts, the chain's plate, excepted, as listed in the test).
13. **Strict TypeScript.** As 5a: the source's formulas and their order are kept; array reads go through `at` (which throws on a miss), meshes stay `number[]` (M3.5d makes the GPU buffers).

## Files

- **Create** `packages/figures/src/parts/`: `mesh.ts`, `superquadric.ts`, `limb.ts`, `skin-weights.ts`, `reach.ts`, `texels.ts`, `parts.test.ts`.
- **Create** `packages/figures/src/garments/`: `body.ts`, `head.ts`, `hands-feet.ts`, `face.ts`, `locks.ts`, `classic.ts`, `dress.ts`.
- **Create** `packages/figures/src/hair/`: `skull.ts`, `sweep.ts`, `shell.ts`, `tones.ts`, `hair-parts.ts`, `tail.ts`, `cap.ts`.
- **Create** `packages/figures/src/streetwear/`: `loft.ts`, `under.ts`, `tops.ts`, `layering.ts`, `knits.ts` (puffer, tee, hoodie), `leather.ts` (moto jacket, bomber), `bottoms.ts`, `accessories.ts` (sneakers, chain, hoops, shades), `registry.ts`.
- **Create** `packages/figures/src/build/`: `build.ts`, `anchors.ts`, `materials.ts`, `build.test.ts` (F-d, golden geometry, materials, anchors, hairPieces), `random.test.ts` (random characters).
- **Create** `packages/figures/src/testing/`: `random-character.ts`, `fixture-library.ts`, `figurebuilder-goldens.json`.
- **Modify** `packages/figures/src/figure/garment.schema.ts` (decision 7), `figure/figure.schema.ts` (decision 6), `index.ts`, `tooling/api-report/reports/figures.api.md` (`pnpm api-report --update`).

## Interfaces

- **Produced:** `build`, `Built`, `FigureLibrary`, `BuiltMaterial`, `Part`, `Mesh`, `Decal`, `GROUP`, `Anchor`, `AnchorKind`, `clearance`, `FIGURE_PPM`, the garment interfaces and `Garment` union.
- **Consumed:** 5a's math, rig (`J`, `Skeleton`, `at`), `Measure`/`measure`, `genesOf`, the library types (`Swatch`, `HairStyle`, `Piece`, `Rope`, `Headwear`, `Cap`, `Lock`, `ItemDef`), `FigureDef`.
- **For later rows:** M3.5c reads `Anchor`, `clearance`'s result and the hem pivots' skin; M3.5d reads `Built` (one `Mesh3D` per part, skinned parts on the CPU, decals as quads, materials through the palette).

## Steps

- [ ] **1. Plan.** This file, committed first.
- [ ] **2. Goldens.** Run FigureBuilder `a1f7246` on Node 24 (scratchpad copy) for the six fixture outfits; write `testing/figurebuilder-goldens.json`.
- [ ] **3. Red: primitives.** `parts/parts.test.ts`: a superquadric is closed with unit normals pointing out; `limb` keeps inside its keys; `tube` with an arc is open; weights sum to 1; `reach` finds a box's face; `texels` rounds to `FIGURE_PPM`. Run: fails for the missing modules.
- [ ] **4. Green: primitives.** `parts/*` from `parts.ts`. Step 3 passes.
- [ ] **5. Red: build.** `build/build.test.ts`: the six golden outfits match FigureBuilder's geometry; every part is bound to a real joint (a bone, or skin weights summing to 1); every position and normal is finite; every material a part or decal names resolves to a palette colour; Wick's and the keeper's outfits offer a hip anchor each side and their clearance is in [0, 0.6]; an item adds its parts on the hand's socket; `hairPieces` (decision 6); F-d: `build` is pure (deep-frozen inputs, the same result twice, outfit A after B equals A) and never changes the skeleton (every joint's rest and offset the same before and after each outfit). `build/random.test.ts`: 40 seeded random characters build without throwing, every vertex finite, every material resolves; FigureBuilder's "the registry in the random cast" (each swatch in a role of its kind; the outfit offers anchors, a hip among them). Run: fails for the missing modules.
- [ ] **6. Green: garments and hair.** `garments/*`, `hair/*`, `build/*` with the classic garments. The classic golden outfits pass.
- [ ] **7. Green: streetwear and random characters.** `streetwear/*`, `testing/random-character.ts`. Step 5 passes.
- [ ] **8. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm api-report --update`. No changeset (private), no parity (no sim, renderer, ui or golden image), no build (source-only package).
- [ ] **9. Hand off.** Push `claude/3d-m3-5b-build`; report.

## Gates

- Selected: the package's tests while iterating (`pnpm --filter @mcthaydt/automata-figures test`, `typecheck`); `pnpm format` and `TURBO_FORCE=true pnpm check` at the end; `pnpm api-report --update`.
- Omitted: parity (no sim, renderer, ui or golden image), `pnpm build`, `api-index`, `agent-skills` (private and unbuilt; `pnpm check` runs their unit tests), changesets (private), e2e (nothing runs in a browser).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
