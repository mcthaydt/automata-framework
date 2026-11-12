// What hangs on a wall (a picture, a pinboard, a radiator, a vent, a clock, a key cabinet) is a thin box with its back on
// the wall. The world builder links each of its parts to that wall, and the occluder rule then hides it with the wall:
// a wall is a single-sided face and is culled when the camera stands behind it, but the back of a box still draws, lit by
// ambient alone as a flat dark slab.
import type { Generator } from '@automata/3d/props-kit'

/** `generator`, its every part marked as hung on a wall. */
export const wallMounted =
  (generator: Generator): Generator =>
  (params) => {
    const built = generator(params)
    return { ...built, pieces: built.pieces.map((piece) => ({ ...piece, mount: 'wall' as const })) }
  }
