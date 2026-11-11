// The base interior with the nine ward props in it: the floor props in two rows and the two wall props on the north wall,
// where their backs go. One layout for the unit test (it builds and checks reads) and the browser test (it draws it).
import { BASE_SCENES } from '@automata/3d/base'
import type { AfSector2 } from '@automata/3d/level'

/** The kinds that hang on a wall, each at the height its generator hangs it. */
export const ON_WALL: ReadonlySet<string> = new Set(['wallClock', 'keyCabinet'])

export const KINDS = [
  'sink',
  'trolley',
  'wheelchair',
  'gurney',
  'monitorCart',
  'wallClock',
  'keyCabinet',
  'locker',
  'dripStand',
] as const

const FLOOR = KINDS.filter((kind) => !ON_WALL.has(kind))

/** Where each stands, `[x, z]` in the room (the north wall is z = −2.5). */
export const PLACES: Readonly<Record<string, readonly [number, number]>> = {
  ...Object.fromEntries(
    FLOOR.map((kind, i): [string, readonly [number, number]] => [
      kind,
      [-2.2 + (i % 4) * 1.5, -0.8 + Math.floor(i / 4) * 2],
    ]),
  ),
  wallClock: [-1, -2.5],
  keyCabinet: [1, -2.5],
}

/** The room with the props named in `only` (every one when it is left out), each with the parameters `params` gives its kind. */
export function wardRoom(
  only: readonly string[] = KINDS,
  params: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): AfSector2 {
  return {
    ...BASE_SCENES['base-interior'],
    props: only.map((kind) => ({
      id: kind,
      use: kind,
      at: [...(PLACES[kind] as readonly [number, number])],
      ...(params[kind] === undefined ? {} : { with: params[kind] }),
    })),
  }
}
