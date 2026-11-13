// biome-ignore-all assist/source/organizeImports: the exports are grouped by subject under their own comments; a sort would detach the comments
/**
 * The painter's toolkit: a second public entry, beside `src/entries/index.ts`, for a host that paints its own geometry in
 * the painter's look (a scene host paints its walls with this rasteriser and palette). These are the internals
 * a door reaches for, made public and stable: a door imports `src/entries/index.ts` and `src/entries/kit.ts` (and `view.ts`)
 * and nothing deeper. Re-exports only; no name here is renamed or moved. Every name is stable: adding, removing or
 * changing one follows docs/contract.md (the breaking-change list, STAGE_VERSION and the changelog), and
 * tests/unit/api.test.ts pins the list. A downstream that needs more asks for it to be added here.
 */
export {
  gbuffer,
  rasterize,
  resolve,
  cleanup,
  noise3,
  STYLE,
  TRI,
  VERT,
  type GBuffer,
} from '../shared/paint/raster'
export { duel, oklab, paintedTones, rampOf } from '../shared/paint/paint'
export { RAMPS, RAMP_OUTLINE } from '../shared/paint/duel-ramps'
export { placed, superquadric, limb, type Mesh, type Material } from '../shared/body/parts'
// For a host's own garment kinds (H1): the part groups, skin weights, and the limb and ring shapes they are built from.
export { GROUP, weights, type Limb, type Ring } from '../shared/body/parts'
export { axisAngle, normalize, apply, sub, cross, dot, lerp, type V3 } from '../shared/math/math'
export { qmul, smooth } from '../shared/math/math'
export { fk, J } from '../shared/body/rig'
// For a host's headwear kinds (H1): the head's form and the skull's measures, from which a crown is lofted over the head the sliders make
// (the hair's own pieces are built from them), and a point on the head's form at a skull angle and height.
export { skull, onHead, type Skull } from '../shared/hair/hair'
export { headForm, type HeadForm } from '../shared/body/head'
