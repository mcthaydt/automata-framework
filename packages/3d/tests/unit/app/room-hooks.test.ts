// The room hooks: each frame they read the view, the player, the peek and the cutscene from a game's accessors, ask the
// room model what to draw, and tell the world. A world drawn in a real `drawWorld` shows and hides its pieces by room without
// touching the `visible` flag the occluder rule and a prop's state own.
import { Container3D, type Mesh3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { roomHooks } from '#src/app/room-hooks.ts'
import { drawWorld } from '#src/app/world-view.ts'
import { buildWorld } from '#src/features/world/build.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'

const room = (id: string, x0: number) => ({
  id,
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x0, 0],
    [x0 + 4, 0],
    [x0 + 4, 4],
    [x0, 4],
  ] as [number, number][],
})
const level: AfSector2 = {
  format: 'af-sector/2',
  name: 't',
  sectors: [room('a', 0), room('b', 4), room('c', 8)],
  views: { onlyA: { rooms: ['a'] }, onlyB: { rooms: ['b'] }, all: {} },
}
const LIB = { swatches: { oakFloor: {}, plasterWarm: {}, trimWhite: {} } }
const { pieces } = buildWorld(level, LIB)
const frame = (ms: number) => ({ alpha: 1, frameMs: ms, paused: false })

/** Whether a node draws: itself and every node above it is visible (`@pixi/3d`'s `worldVisible`, before a view works it out). */
const draws = (node: Container3D | null | undefined): boolean =>
  node === null || node === undefined ? true : node.visible && draws(node.parent as Container3D | null)

/** The sectors whose floor is drawn. */
const drawnFloors = (view: ReturnType<typeof drawWorld>): string[] =>
  pieces
    .filter((piece) => piece.part === 'floor')
    .filter((piece) => draws(view.mesh(piece.id)))
    .map((piece) => piece.sector)

type State = {
  view?: string | undefined
  at?: { x: number; z: number } | undefined
  peek?: { x: number; z: number } | undefined
  cutscene?: boolean | undefined
}

function setup(state: State) {
  const world = drawWorld({ parent: new Container3D(), colourOf: () => 0 }, pieces)
  const hooks = roomHooks({
    level,
    world,
    view: () => state.view,
    player: () => state.at,
    peek: () => state.peek,
    cutscene: () => state.cutscene === true,
  })
  return { world, hooks }
}

describe('drawWorld.showRooms', () => {
  it('leaves the meshes directly under the node until it is asked, and keeps them where they stand after', () => {
    const world = drawWorld({ parent: new Container3D(), colourOf: () => 0 }, pieces)
    const floor = world.mesh('a:floor') as Mesh3D
    expect(floor.parent).toBe(world.node)
    world.showRooms(new Set(['a']))
    expect(floor.parent).not.toBe(world.node)
    expect(floor.parent?.parent).toBe(world.node)
    expect(floor.position.x + floor.position.y + floor.position.z).toBe(0)
    expect(world.mesh('a:floor')).toBe(floor)
  })

  it('shows only the pieces of the rooms named, and leaves a mesh’s own `visible` to the rule', () => {
    const world = drawWorld({ parent: new Container3D(), colourOf: () => 0 }, pieces)
    const wall = pieces.find(
      (piece) => piece.sector === 'b' && piece.part === 'wall',
    ) as (typeof pieces)[number]
    ;(world.mesh(wall.id) as Mesh3D).visible = false
    world.showRooms(new Set(['a']))
    expect(drawnFloors(world)).toEqual(['a'])
    // The wall the occluder rule hid is still hidden by it; the room hiding only touched its own flag.
    expect((world.mesh(wall.id) as Mesh3D).visible).toBe(false)
    world.showRooms(new Set(['a', 'b']))
    expect(drawnFloors(world)).toEqual(['a', 'b'])
    expect((world.mesh(wall.id) as Mesh3D).visible).toBe(false)
    world.showRooms(undefined)
    expect(drawnFloors(world)).toEqual(['a', 'b', 'c'])
  })

  it('draws a room again when it is shown, after it was hidden', () => {
    const world = drawWorld({ parent: new Container3D(), colourOf: () => 0 }, pieces)
    world.showRooms(new Set(['c']))
    world.showRooms(new Set(['a']))
    expect(drawnFloors(world)).toEqual(['a'])
  })
})

describe('roomHooks', () => {
  it('draws the view’s rooms and the player’s own, and holds the room just left for 0.35 s', () => {
    const state: State = { view: 'onlyA', at: { x: 2, z: 2 } }
    const { world, hooks } = setup(state)
    hooks.draw?.(frame(16))
    expect(drawnFloors(world)).toEqual(['a'])
    state.view = 'onlyB'
    state.at = { x: 6, z: 2 }
    hooks.draw?.(frame(16))
    expect(drawnFloors(world)).toEqual(['a', 'b'])
    hooks.draw?.(frame(300))
    expect(drawnFloors(world)).toEqual(['a', 'b'])
    hooks.draw?.(frame(100))
    expect(drawnFloors(world)).toEqual(['b'])
  })

  it('draws the far side of a peek, and every room in a cutscene', () => {
    const state: State = { view: 'onlyA', at: { x: 2, z: 2 } }
    const { world, hooks } = setup(state)
    state.peek = { x: 6, z: 2 }
    hooks.draw?.(frame(16))
    expect(drawnFloors(world)).toEqual(['a', 'b'])
    state.peek = undefined
    state.cutscene = true
    hooks.draw?.(frame(16))
    expect(drawnFloors(world)).toEqual(['a', 'b', 'c'])
  })

  it('a reset forgets what was held', () => {
    const state: State = { view: 'onlyA', at: { x: 2, z: 2 } }
    const { world, hooks } = setup(state)
    hooks.draw?.(frame(16))
    state.view = 'onlyB'
    state.at = { x: 6, z: 2 }
    hooks.draw?.(frame(16))
    hooks.reset?.()
    hooks.draw?.(frame(16))
    expect(drawnFloors(world)).toEqual(['b'])
  })

  it('with no view yet draws everything', () => {
    const { world, hooks } = setup({ view: undefined, at: undefined })
    hooks.draw?.(frame(16))
    expect(drawnFloors(world)).toEqual(['a', 'b', 'c'])
  })
})
