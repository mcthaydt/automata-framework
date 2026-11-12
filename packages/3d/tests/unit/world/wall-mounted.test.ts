// A thing hung on a wall (a frame, a pinboard, a radiator, a vent) takes its wall's `occlude`: the builder names the wall
// it hangs on, so a wall the camera cuts takes it away too, instead of leaving its back drawn as a flat slab.
import { describe, expect, it } from 'vitest'
import { buildWorld, type WorldPiece } from '#src/features/world/build.ts'
import { box } from '#src/features/world/mesh.ts'
import { part } from '#src/features/world/props/piece.ts'
import { registerPropGenerator } from '#src/features/world/props/prop-generator-registry.ts'
import type { AfSector2, PropPlace } from '#src/shared/level/af-sector-2.schema.ts'

// A frame as a generator draws one: a thin box, its back on the wall, marked as hung on it. A chair is not.
registerPropGenerator('test.hung', () => ({
  pieces: [part(box([0, 0, 0.02], [0.6, 0.4, 0.04]), 'wood', 'frame', { mount: 'wall' })],
}))
// A sign's panel is let into the wall: its back is behind the face, its front 0.01 m proud.
registerPropGenerator('test.sunk', () => ({
  pieces: [part(box([0, 0, -0.035], [0.6, 0.4, 0.08]), 'wood', 'panel', { mount: 'wall' })],
}))
registerPropGenerator('test.stood', () => ({
  pieces: [part(box([0, 0, 0.2], [0.5, 0.9, 0.4]), 'wood', 'seat')],
}))
const LIBRARY = { swatches: { wood: {}, floor: {}, wall: {}, ceiling: {} } }

/** A 6 × 6 room; its south wall (z = 0, the room on its +z side) says `occlude`; the east wall says nothing. */
const level = (props: PropPlace[], occlude?: 'cut' | 'fade' | 'never'): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors: [
    {
      id: 'hall',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 1,
      corners: [
        [0, 0, occlude === undefined ? {} : { occlude }],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
    },
  ],
  props,
})

// Angle 90 faces south (+z): the frame's back is on the wall at z = 0 and it stands 0.01 m off it, as the kit hangs one.
const onSouth: PropPlace = { id: 'frame', kind: 'test.hung', at: [2, 0.01, 1.4], angle: 90 }
const wallsOf = (pieces: readonly WorldPiece[]): WorldPiece[] =>
  pieces.filter((p) => p.part === 'wall' && p.line !== undefined)
const southWall = (pieces: readonly WorldPiece[]): WorldPiece =>
  wallsOf(pieces).find((p) => p.line?.a[1] === 0 && p.line.b[1] === 0) as WorldPiece
const frameOf = (pieces: readonly WorldPiece[]): WorldPiece =>
  pieces.find((p) => p.prop?.id === 'frame') as WorldPiece

describe('a wall-mounted piece follows its wall', () => {
  it('names the wall it hangs on and carries that wall’s rule', () => {
    const { pieces } = buildWorld(level([onSouth], 'fade'), LIBRARY)
    const frame = frameOf(pieces)
    expect(frame.onWall).toBe(southWall(pieces).id)
    expect(frame.occlude).toBe('fade')
  })

  it('names the wall but carries no rule of its own where the wall says nothing (the wall is cut)', () => {
    const { pieces } = buildWorld(level([onSouth]), LIBRARY)
    const frame = frameOf(pieces)
    expect(frame.onWall).toBe(southWall(pieces).id)
    expect(frame.occlude).toBeUndefined()
  })

  it('hangs on the wall it is against, whichever wall that is', () => {
    // Against the east wall (x = 6, facing west); the south wall says `never`, so a frame wrongly taking it would show.
    const east: PropPlace = { id: 'frame', kind: 'test.hung', at: [5.99, 3, 1.4], angle: 180 }
    const { pieces } = buildWorld(level([east], 'never'), LIBRARY)
    const frame = frameOf(pieces)
    expect(frame.onWall).toBeDefined()
    expect(frame.onWall).not.toBe(southWall(pieces).id)
    expect(frame.occlude).toBeUndefined()
  })

  it('stays free where nothing is behind it: a piece in the middle of the room follows no wall', () => {
    const middle: PropPlace = { id: 'frame', kind: 'test.hung', at: [3, 3, 1.4], angle: 90 }
    const { pieces } = buildWorld(level([middle], 'fade'), LIBRARY)
    expect(frameOf(pieces).onWall).toBeUndefined()
    expect(frameOf(pieces).occlude).toBeUndefined()
  })

  it('hangs a panel let into the plaster on that wall too', () => {
    const sign: PropPlace = { id: 'frame', kind: 'test.sunk', at: [2, 0.01, 2.2], angle: 90 }
    const { pieces } = buildWorld(level([sign], 'fade'), LIBRARY)
    expect(frameOf(pieces).onWall).toBe(southWall(pieces).id)
  })

  it('leaves furniture that is not hung alone, even against a wall', () => {
    const chair: PropPlace = { id: 'frame', kind: 'test.stood', at: [2, 0.02], angle: 90 }
    const { pieces } = buildWorld(level([chair], 'fade'), LIBRARY)
    expect(frameOf(pieces).onWall).toBeUndefined()
  })
})
