// The clinic's furniture: for each model the source's props list names, the world kit preset that stands in for it, or nothing
// where the kit has no shape for it (that one stays a stand-in box). A prop of the level is the kit's generator built by `fit` at
// the box the source's model filled (`with.size`, in the prop's own frame), so the room keeps its masses and the dressing
// reads as furniture. Only the box and the spot are the source's; the shapes and swatches are the kit's.

export interface Replacement {
  /** The kit preset that draws it. */
  use: string
  /** Degrees about y the prop is turned before it is fitted (the kit builds a bed lengthwise along x). */
  turn?: number
  /** Parameters over the preset's, for the part the preset does not say (the material of a crate). */
  with?: Record<string, unknown>
}

export const REPLACEMENTS: Readonly<Record<string, Replacement>> = {
  // The bed's length runs along z in the source, its head to the north (-z).
  bed: { use: 'bed.single', turn: -90 },
  gurney: { use: 'gurney' },
  wheelchair: { use: 'wheelchair' },
  'iv-stand': { use: 'iv-stand' },
  'monitor-cart': { use: 'monitor-cart' },
  bench: { use: 'chair.row' },
  filing: { use: 'cabinet.filing' },
  drawers: { use: 'dresser' },
  nightstand: { use: 'nightstand' },
  'office-chair': { use: 'chair.cushion' },
  'overbed-table': { use: 'desk' },
  'mop-bucket': { use: 'mop.bucket' },
  'desk-lamp': { use: 'lamp.desk' },
  'pendant-lamp': { use: 'lamp.barPendant' },
  'waste-bin': { use: 'bin' },
  'key-cabinet': { use: 'wardrobe' },
  'floor-plant': { use: 'plant.fronds' },
  'desk-plant': { use: 'plant.pot' },
  'book-stack': { use: 'books.stack' },
  ledger: { use: 'paper' },
  radiator: { use: 'radiator' },
  'water-cooler': { use: 'cooler.water' },
  'stock-boxes': { use: 'crate' },
  'stock-archive': { use: 'crate', with: { mat: 'oak' } },
  'stock-toolbox': { use: 'crate', with: { mat: 'ironDark' } },
  'stock-linen': { use: 'crate', with: { mat: 'linen' } },
  'stock-bandages': { use: 'crate', with: { mat: 'pillowWhite' } },
  'stock-bottles': { use: 'bottles' },
  'stock-canisters': { use: 'bottles' },
  'stock-rolls': { use: 'barrel' },
  // The rolling and wall pieces. A trolley is the monitor cart; the wall TV is the kit's screen (a deep box, not a slab, once fitted).
  trolley: { use: 'monitor-cart' },
  'wall-tv': { use: 'screen.tv' },
  'wall-sconce': { use: 'lamp.wall' },
  'junction-box': { use: 'box.utility' },
  clock: { use: 'plaque' },
  // A chair on its side is a turn about z, which `fit` does not have: it stands, in the box the fallen one lay in.
  'fallen-chair': { use: 'chair.wood' },
  // Pieces the kit gained for the clinic (`ward-fittings.ts`).
  sink: { use: 'sink' },
  'privacy-screen': { use: 'screen.privacy' },
  'coat-hook': { use: 'coat.hooks' },
  'extinguisher-cabinet': { use: 'cabinet.extinguisher' },
  'strip-light': { use: 'light.strip' },
}

/** Swatches the kit's furniture generators name by default, which the clinic's library must carry besides its own. */
export const FURNITURE_SWATCHES: string[] = [
  'leatherBlack', 'cordBlack', 'bookGreen', 'bookCream',
  // The new fittings' own: the cabinet's red and glass, the strip light's tube, the sink's porcelain, the coat's cloth.
  'metalBox', 'doorRed', 'carGlass', 'bulbCool', 'potWhite', 'fabricKnit', 'metalSheet',
]
