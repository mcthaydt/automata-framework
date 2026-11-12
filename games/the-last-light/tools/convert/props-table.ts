// Which generator draws each of the old game's furniture models. A prop is placed again, not converted (the old models
// are meshes this framework does not carry): each model becomes a generator of core or the world kit at the same place
// and about the same footprint. A model with no generator is written as a plain box of its size and reported, so no
// collider is ever missing.

/** A model of the old clinic's furniture, placed: where, how it is turned and how big it is. */
export interface PlacedModel {
  /** The model's name (`bed`, `wheelchair`). */
  readonly file: string
  readonly x: number
  readonly z: number
  /** Height above the floor, in metres; 0 on the floor. */
  readonly y?: number | undefined
  /** Turn about the up axis, in radians. */
  readonly yaw?: number | undefined
  /** Width, height, depth. */
  readonly size: readonly [number, number, number]
  /** The id of the box it stands on, when the old level gave it one. */
  readonly collider?: string | undefined
}

/**
 * The generator (a library preset of the same name) for a model, or undefined when none draws it. This is what the converter
 * wrote once. The level file is the game's source now and has since been dressed by hand: where a name below is a generator
 * and not a preset the library has (`bed`, `cabinet`, `chair`, `screen`, `lamp`, `plant`, `table`...) the level names the kit's
 * preset or the generator with its settings (`use` and `with`), and two models no kit prop is (a chair on its side, a folding
 * screen) are left out of it.
 */
export const GENERATOR_OF: Readonly<Record<string, string>> = {
  bed: 'bed',
  wheelchair: 'wheelchair',
  'fallen-chair': 'chair',
  'office-chair': 'chair',
  bench: 'bench',
  sink: 'sink',
  trolley: 'trolley',
  filing: 'filingCabinet',
  drawers: 'cabinet',
  nightstand: 'cabinet',
  clock: 'wallClock',
  'monitor-cart': 'monitorCart',
  'iv-stand': 'dripStand',
  'wall-tv': 'screen',
  'privacy-screen': 'screen',
  'mop-bucket': 'mopBucket',
  'desk-lamp': 'lamp',
  'pendant-lamp': 'lamp',
  'waste-bin': 'bin',
  'key-cabinet': 'keyCabinet',
  'floor-plant': 'plant',
  'desk-plant': 'plant',
  'book-stack': 'bookStack',
  ledger: 'paper',
  'overbed-table': 'table',
  radiator: 'radiator',
  gurney: 'gurney',
  'water-cooler': 'waterCooler',
  'junction-box': 'utilityBox',
}

/** The id a placed prop gets: its model's name, numbered when the same model stands more than once. */
export function propIds(models: readonly PlacedModel[]): readonly string[] {
  const seen = new Map<string, number>()
  const total = new Map<string, number>()
  for (const model of models) total.set(model.file, (total.get(model.file) ?? 0) + 1)
  return models.map((model) => {
    const nth = (seen.get(model.file) ?? 0) + 1
    seen.set(model.file, nth)
    return (total.get(model.file) ?? 1) > 1 ? `${model.file}-${nth}` : model.file
  })
}
