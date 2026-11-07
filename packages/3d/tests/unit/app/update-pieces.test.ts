// Applying a change of the pieces' states: a door turns about its hinge, a prop moves or goes, only the pieces whose
// state changed are touched, and a piece at its authored state sits where the builder put it.
import { Container3D, type Mesh3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { updatePieces } from '#src/app/update-pieces.ts'
import { drawWorld, type WorldView } from '#src/app/world-view.ts'
import { buildWorld } from '#src/features/world/build.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'
import { noPieceStates, type PieceStates } from '#src/shared/level/piece-states.ts'

const room = (id: string, x0: number, door?: boolean) => ({
  id,
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x0, 0],
    [x0 + 6, 0],
    [x0 + 6, 6],
    [x0, 6],
  ] as [number, number][],
  ...(door === true ? { door: {} } : {}),
})
const level: AfSector2 = {
  format: 'af-sector/2',
  name: 't',
  sectors: [room('hall', 0), room('cell', 10, true)],
  props: [
    { id: 'crate', use: 'crate', at: [2, 2] },
    { id: 'drum', use: 'crate', at: [4, 4] },
  ],
}
const LIB = {
  swatches: { oakFloor: {}, plasterWarm: {}, trimWhite: {}, crate: {}, doorWood: {}, brass: {} },
  props: { crate: { kind: 'box', swatch: 'crate', size: [1, 1, 1] } },
}
const world = buildWorld(level, LIB)
const doorPieces = world.pieces.filter((piece) => piece.door !== undefined)
const cratePieces = world.pieces.filter((piece) => piece.prop?.id === 'crate')

const drawn = (): WorldView => drawWorld({ parent: new Container3D(), colourOf: () => 0 }, world.pieces)
const states = (change: Partial<PieceStates>): PieceStates => ({ ...noPieceStates(), ...change })
const meshOf = (view: WorldView, id: string): Mesh3D => view.mesh(id) as Mesh3D

describe('updatePieces', () => {
  it('the level has a door and a crate to move', () => {
    expect(doorPieces.length).toBeGreaterThan(0)
    expect(cratePieces).toHaveLength(1)
  })

  it('a door key changes only that door', () => {
    const view = drawn()
    const changed = updatePieces(view, noPieceStates(), states({ doors: { cell: 1 } }))
    expect(changed).toBe(doorPieces.length)
    const other = world.pieces.find((piece) => piece.sector === 'hall' && piece.part === 'wall')
    expect(meshOf(view, (other as NonNullable<typeof other>).id).rotation.y).toBe(0)
  })

  it('turns a door about its hinge: the hinge stays where it is', () => {
    const view = drawn()
    updatePieces(view, noPieceStates(), states({ doors: { cell: 1 } }))
    const panel = doorPieces[0] as NonNullable<(typeof doorPieces)[number]>
    const mesh = meshOf(view, panel.id)
    const { hinge, swing } = panel.door as NonNullable<typeof panel.door>
    const turn = (swing * Math.PI) / 180
    expect(mesh.rotation.y).toBeCloseTo(turn, 6)
    // The mesh turns about its origin and then moves: the hinge point maps to itself.
    const [c, s] = [Math.cos(turn), Math.sin(turn)]
    expect(c * hinge[0] + s * hinge[2] + mesh.position.x).toBeCloseTo(hinge[0], 6)
    expect(-s * hinge[0] + c * hinge[2] + mesh.position.z).toBeCloseTo(hinge[2], 6)
  })

  it('opens a door by the share it was set to, and shuts it again', () => {
    const view = drawn()
    const panel = doorPieces[0] as NonNullable<(typeof doorPieces)[number]>
    const { swing } = panel.door as NonNullable<typeof panel.door>
    updatePieces(view, noPieceStates(), states({ doors: { cell: 0.5 } }))
    expect(meshOf(view, panel.id).rotation.y).toBeCloseTo((swing * 0.5 * Math.PI) / 180, 6)
    updatePieces(view, states({ doors: { cell: 0.5 } }), noPieceStates())
    expect(meshOf(view, panel.id).rotation.y).toBeCloseTo(0, 6)
    expect(meshOf(view, panel.id).position.x).toBeCloseTo(0, 6)
  })

  it('changes nothing when nothing changed', () => {
    expect(updatePieces(drawn(), states({ doors: { cell: 1 } }), states({ doors: { cell: 1 } }))).toBe(0)
  })

  it('moves a prop with all of its pieces, about the place it was put', () => {
    const view = drawn()
    const changed = updatePieces(view, noPieceStates(), states({ props: { crate: { at: [5, 0, 5] } } }))
    expect(changed).toBe(cratePieces.length)
    const mesh = meshOf(view, (cratePieces[0] as NonNullable<(typeof cratePieces)[number]>).id)
    // Authored at (2, 0, 2): moved by (3, 0, 3).
    expect(mesh.position.x).toBeCloseTo(3, 6)
    expect(mesh.position.z).toBeCloseTo(3, 6)
    const drum = world.pieces.find((piece) => piece.prop?.id === 'drum')
    expect(meshOf(view, (drum as NonNullable<typeof drum>).id).position.x).toBe(0)
  })

  it('turns a prop about its own base, and hides it', () => {
    const view = drawn()
    const crate = cratePieces[0] as NonNullable<(typeof cratePieces)[number]>
    updatePieces(view, noPieceStates(), states({ props: { crate: { turn: 90 } } }))
    const mesh = meshOf(view, crate.id)
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 2, 6)
    // The base centre (2, 0, 2) maps to itself.
    expect(Math.cos(Math.PI / 2) * 2 + Math.sin(Math.PI / 2) * 2 + mesh.position.x).toBeCloseTo(2, 6)
    expect(-Math.sin(Math.PI / 2) * 2 + Math.cos(Math.PI / 2) * 2 + mesh.position.z).toBeCloseTo(2, 6)
    updatePieces(
      view,
      states({ props: { crate: { turn: 90 } } }),
      states({ props: { crate: { hidden: true } } }),
    )
    expect(mesh.visible).toBe(false)
    updatePieces(view, states({ props: { crate: { hidden: true } } }), noPieceStates())
    expect(mesh.visible).toBe(true)
    expect(mesh.position.x).toBeCloseTo(0, 6)
  })
})
