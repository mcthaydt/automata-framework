import { figure, type View3dFactory } from '@automata/3d'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '@automata/3d/base'
import { clipsWithActions, type FigureLibrary, type MotionLibrary } from '@automata/3d/figures'
import { Actor } from './actor.component.ts'

type Kind<T> = Readonly<Record<string, T>>

interface FigureKinds {
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
 * How every character the systems move looks: the base woman from 3D core, walking Wick's gait while the sim says it
 * is walking. Her swatches are core's; the gait comes from the game's content, as Wick's does.
 */
export function actorView(content: unknown, speed: number): View3dFactory {
  const kinds = content as FigureKinds
  const library: FigureLibrary = {
    swatches: { ...BASE_PAIR_SWATCHES, ...kinds['figure-swatch'] },
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
  return figure(
    { ...BASE_PAIR.woman, gait: 'bounce' },
    {
      library,
      motion,
      state: (components) => {
        const walking = components[Actor.id]?.walking === true
        return { moving: walking, speed: walking ? speed : 0 }
      },
    },
  )
}
