// The base interior and exterior with one place furnished from a kit: a waiting room, and a street. They are built from
// core's bare scenes, so the two never drift, and dressed once here (seed 1), so each is an ordinary level core draws
// with no extension. Every look change is judged on the bare scenes and on these.
import { BASE_SCENES } from '@automata/3d/base'
import type { AfSector2 } from '@automata/3d/level'
import { dressLevel } from '../features/furnish/dress.ts'
import { worldKitLibrary } from './world-kit-library.ts'

/** The scene with `room` asking to be dressed as `as`, then dressed. */
function dressedScene(scene: AfSector2, name: string, room: string, as: string): AfSector2 {
  const asking: AfSector2 = {
    ...scene,
    name,
    sectors: scene.sectors.map((sector) =>
      sector.id === room ? { ...sector, dress: { as, seed: 1 } } : sector,
    ),
  }
  return dressLevel(asking, worldKitLibrary).level
}

export const dressedBaseScenes: Readonly<
  Record<'base-interior-dressed' | 'base-exterior-dressed', AfSector2>
> = {
  'base-interior-dressed': dressedScene(
    BASE_SCENES['base-interior'],
    'base-interior-dressed',
    'room',
    'waitingRoom',
  ),
  'base-exterior-dressed': dressedScene(
    BASE_SCENES['base-exterior'],
    'base-exterior-dressed',
    'pavement',
    'street',
  ),
}
