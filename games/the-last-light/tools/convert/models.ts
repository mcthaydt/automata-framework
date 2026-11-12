// The old furniture's models, placed on the level's blockouts. A prop of the level is a generated blockout: it owns the
// prop's place, turn, footprint and height. This names the model that replaces it on screen (the old game's own file for that
// piece of furniture) and the turn that puts the model at the old game's yaw, and where a blockout is not the old game's box
// it is replaced by that box, so the model is fitted to the size it had. It reads the level and the old prop table, never the
// renderer: a model's bounds come from its file's header. Used once, by `convert.ts --models`, and kept as a record.
import { type PlacedModel, propIds } from './props-table.ts'

type Json = Record<string, unknown>

/** A model's own bounds, from its pack header. */
export interface Bounds {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

/** The old models that were stretched to their table's size instead of scaled to its height (the rest keep their proportions). */
export const STRETCHED: ReadonlySet<string> = new Set(['trolley', 'drawers', 'strip-light'])

/** Where the game serves a model of the old furniture from. */
export const modelPath = (file: string): string => `models/${file}.bin`

/** The bounds in a packed model (`LLP1`): four words (magic, vertices, indices, image length) then the box as six floats. */
export function modelBounds(pack: Uint8Array): Bounds {
  const view = new DataView(pack.buffer, pack.byteOffset, pack.byteLength)
  const at = (i: number): number => view.getFloat32(16 + i * 4, true)
  return { min: [at(0), at(1), at(2)], max: [at(3), at(4), at(5)] }
}

export interface PlaceOptions {
  /** A model file's bounds. */
  readonly bounds: (file: string) => Bounds
  /** The ids of the props whose blockout is replaced by the old game's box. */
  readonly boxed?: ReadonlySet<string> | undefined
  /** The swatch a replacing box is drawn with. */
  readonly swatch?: string | undefined
  /** The turn (degrees, beyond the blockout's own) some models take in place of the old yaw's: those the old game stretched across their length. */
  readonly turned?: Readonly<Record<string, number>> | undefined
  /**
   * Props whose generated blockout carries something that must stay (a lamp's light) and is not the old box: they keep it, and
   * their model is placed at the old scale and moved by this much, so it leaves the blockout by exactly that.
   */
  readonly keep?: Readonly<Record<string, { readonly offset: readonly [number, number, number] }>> | undefined
}

const round = (value: number, places = 3): number => {
  const unit = 10 ** places
  return Math.round(value * unit) / unit
}

/** Degrees in (-180, 180]. */
const around = (degrees: number): number => {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

/** The box the old game fitted `model` to, turned about up by its yaw: its width, height and depth on the plan. */
function oldBox(model: PlacedModel, bounds: Bounds): readonly [number, number, number] {
  const extent = [0, 1, 2].map((axis) => (bounds.max[axis] as number) - (bounds.min[axis] as number))
  const scale = STRETCHED.has(model.file) ? undefined : model.size[1] / (extent[1] as number)
  const [width, height, depth] =
    scale === undefined
      ? model.size
      : ([(extent[0] as number) * scale, model.size[1], (extent[2] as number) * scale] as const)
  const [c, s] = [Math.abs(Math.cos(model.yaw ?? 0)), Math.abs(Math.sin(model.yaw ?? 0))]
  return [width * c + depth * s, height, width * s + depth * c]
}

/**
 * `level` with every old model named on the prop that stands where it stood. A prop that is not found is added as a box of the
 * old size; a prop in `boxed` becomes one. A prop keeps its preset when its blockout is the old box already: only the model and,
 * where the blockout is turned another way than the old yaw, the turn that makes up the difference (`fit.turn`) are written.
 */
export function placeModels(level: unknown, models: readonly PlacedModel[], options: PlaceOptions): unknown {
  const given = (level as { props?: Json[] }).props ?? []
  const props = given.map((prop) => ({ ...prop }))
  const ids = propIds(models)
  models.forEach((model, index) => {
    const id = ids[index] as string
    const bounds = options.bounds(model.file)
    const yaw = round(((model.yaw ?? 0) * 180) / Math.PI, 2)
    const found = props.findIndex((prop) => prop.id === id)
    if (found >= 0 && options.boxed?.has(id) !== true) {
      const prop = props[found] as Json
      // The builder turns a prop by 90 - angle degrees, which is the old yaw for a prop placed as the converter placed it.
      const turn = 90 - ((prop.angle as number | undefined) ?? 90)
      const extra = options.turned?.[id] ?? round(around(yaw - turn), 2)
      prop.model = modelPath(model.file)
      delete prop.fit
      const kept = options.keep?.[id]
      const scale = STRETCHED.has(model.file)
        ? undefined
        : model.size[1] / ((bounds.max[1] as number) - (bounds.min[1] as number))
      if (extra !== 0 || kept !== undefined)
        prop.fit = {
          ...(kept === undefined || scale === undefined ? {} : { scale: round(scale, 4) }),
          ...(kept === undefined ? {} : { offset: [...kept.offset] }),
          ...(extra === 0 ? {} : { turn: extra }),
        }
      return
    }
    const [w, h, d] = oldBox(model, bounds)
    const box: Json = {
      id,
      at: model.y === undefined || model.y === 0 ? [model.x, model.z] : [model.x, model.z, model.y],
      kind: 'box',
      with: { size: [round(w), round(h), round(d)], swatch: options.swatch ?? 'crateWood' },
      model: modelPath(model.file),
      ...(yaw === 0 ? {} : { fit: { turn: yaw } }),
    }
    if (found >= 0) props[found] = box
    else props.push(box)
  })
  return { ...(level as Json), props }
}

/**
 * The props whose generated blockout is not the old game's box (found by measuring the built level against the old table:
 * `docs/superpowers/audits/2026-11-12-last-light-prologue-first-draw`): a wall clock and a key cabinet that float, six floor
 * props the wrong height, two plants off-centre; the chair on its side and the folding screen have no prop yet. Six more were
 * found by fitting the real models (`tests/unit/features/room/models.test.ts`): the measure of the audit looked at height and
 * centre, and these were too thin or too flat in the footprint.
 */
export const BOXED: ReadonlySet<string> = new Set([
  'clock',
  'key-cabinet',
  'sink',
  'monitor-cart',
  'mop-bucket',
  'waste-bin-1',
  'waste-bin-2',
  'water-cooler',
  'floor-plant-1',
  'floor-plant-2',
  // Found by fitting the models: blockouts far thinner or flatter than the model they stand for (a sheet of paper, a wall fitting).
  'ledger',
  'wall-tv',
  'overbed-table',
  'radiator-1',
  'radiator-2',
  'extinguisher-cabinet',
])

/**
 * The ceiling strip lights' model is long in x and the old game stretched it to a box long in z, then turned it: the blockout is
 * long along x, so the model is turned to match, not by the old yaw.
 */
export const TURNED: NonNullable<PlaceOptions['turned']> = { 'strip-light-1': -90, 'strip-light-2': -90 }

/** The pendant stays the kit's lamp (its light is the prop's), 0.18 m short of the old one: its model hangs from the old height. */
export const KEPT: NonNullable<PlaceOptions['keep']> = { 'pendant-lamp': { offset: [0, -0.18, 0] } }
