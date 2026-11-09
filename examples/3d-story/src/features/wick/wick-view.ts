import { figure, type View3dFactory } from '@automata/3d'
import {
  clipsWithActions,
  type FigureDef,
  type FigureLibrary,
  type MotionLibrary,
} from '@automata/3d/figures'
import type { Tuning } from '../../shared/tuning.ts'
import { Wick } from './wick.component.ts'

type Kind<T> = Readonly<Record<string, T>>

/** The figure kinds as the compiled content holds them (content/figures, content/figure-swatches, ...). */
interface FigureKinds {
  readonly figure?: Kind<FigureDef>
  readonly 'figure-swatch'?: FigureLibrary['swatches']
  readonly 'figure-hair'?: FigureLibrary['hair']
  readonly 'figure-headwear'?: FigureLibrary['headwear']
  readonly 'figure-item'?: FigureLibrary['items']
  readonly 'figure-gait'?: MotionLibrary['gaits']
  readonly 'figure-pose'?: MotionLibrary['poses']
  readonly 'figure-clip'?: Parameters<typeof clipsWithActions>[0]
  readonly 'figure-action'?: Parameters<typeof clipsWithActions>[1]
  readonly 'figure-stand'?: MotionLibrary['stands']
  readonly 'figure-rig'?: MotionLibrary['rigs']
}

/**
 * How Wick looks: his figure from content/figures/wick.toml, drawn one mesh a part and posed from his gait. He walks
 * while the sim says so, at the walking speed, and stands otherwise. The compiler checked every record with the
 * figure kinds' schemas, so each is that schema's output; the cast says so once.
 */
export function wickView(content: unknown, tuning: Tuning): View3dFactory {
  const kinds = content as FigureKinds
  const wick = kinds.figure?.wick
  if (wick === undefined) throw new Error('There is no figure "wick". Check content/figures/wick.toml.')
  const library: FigureLibrary = {
    swatches: kinds['figure-swatch'] ?? {},
    hair: kinds['figure-hair'] ?? {},
    headwear: kinds['figure-headwear'] ?? {},
    items: kinds['figure-item'] ?? {},
  }
  const motion: MotionLibrary = {
    gaits: kinds['figure-gait'] ?? {},
    poses: kinds['figure-pose'] ?? {},
    clips: clipsWithActions(kinds['figure-clip'] ?? {}, kinds['figure-action'] ?? {}),
    items: library.items,
    stands: kinds['figure-stand'] ?? {},
    rigs: kinds['figure-rig'] ?? {},
  }
  return figure(wick, {
    library,
    motion,
    state: (components) => {
      const walking = components[Wick.id]?.walking === true
      return { moving: walking, speed: walking ? tuning.WALK_SPEED : 0 }
    },
  })
}
