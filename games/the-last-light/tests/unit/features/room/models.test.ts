import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { drawWorld, modelGeometry, parsePack } from '@automata/3d'
import { modelsOf } from '@automata/3d/level'
import { Container3D, type Mesh3D, PhongMaterial } from '@pixi/3d'
import { Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { game } from '#src/app/game.ts'
import { LEVEL, PAINT, WORLD } from '#src/features/room/room.ts'

// The old game's furniture models replace the generated props on screen. A generated prop is the blockout: it owns the place,
// turn, footprint, height and collider, and the model is fitted to it. This holds the level to that: every prop names the old
// game's model, the file is there, the page loads it before the first frame, and what is drawn stands inside its blockout.

const ROOT = join(import.meta.dirname, '../../../..')
const FILES = modelsOf(LEVEL)

/** The models read from the shipped files, as the renderer would hold them (Node has no image decoder: no texture). */
const library = {
  get: (file: string) => {
    const bytes = readFileSync(join(ROOT, 'public', file))
    const mesh = parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), file)
    return { mesh, geometry: modelGeometry(mesh), material: new PhongMaterial(), texture: Texture.WHITE }
  },
}
const drawn = drawWorld({ parent: new Container3D(), ...PAINT }, WORLD.pieces, {
  props: WORLD.props,
  models: library,
})

/** What the kit's generator draws, not a model: the old game built its noticeboard from a cork-textured box (`dress.ts` line 126 at 92e6704). */
const GENERATED = ['noticeboard']
const MODELLED = WORLD.props.filter((prop) => !GENERATED.includes(prop.id))

/** The old game's models that were stretched to their box in the old game; ours keeps their proportions. */
const STRETCHED = ['trolley', 'drawers', 'strip-light-1', 'strip-light-2']

describe('the furniture’s models', () => {
  it('are named by every prop of the level: each has the old game’s model', () => {
    expect(MODELLED.filter((prop) => prop.model === undefined).map((prop) => prop.id)).toEqual([])
    expect(WORLD.props.filter((prop) => prop.model === undefined).map((prop) => prop.id)).toEqual(GENERATED)
    expect(FILES).toHaveLength(41)
  })

  it('are all shipped: a missing file is told here with its name', () => {
    for (const file of FILES) expect(existsSync(join(ROOT, 'public', file)), file).toBe(true)
  })

  it('are fetched before the first frame, so a missing one stops the boot with its name', () => {
    for (const file of FILES) expect(game.preload, file).toContain(file)
  })

  it('draw in place of every blockout, which stays in the world as the collider’s source', () => {
    for (const { id } of MODELLED) {
      expect(drawn.mesh(`model:${id}`), id).toBeDefined()
      for (const piece of WORLD.pieces.filter((each) => each.prop?.id === id))
        expect(drawn.mesh(piece.id), piece.id).toBeUndefined()
    }
    expect(drawn.pieces).toBe(WORLD.pieces)
  })

  /** The box a prop's model is drawn in, from the mesh's vertices. */
  const boundsOf = (id: string) => {
    const positions = (drawn.mesh(`model:${id}`) as Mesh3D).geometry.attributes.aPosition?.buffer
      .data as Float32Array
    const low = [Infinity, Infinity, Infinity]
    const high = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < positions.length; i += 3)
      for (const axis of [0, 1, 2]) {
        low[axis] = Math.min(low[axis] as number, positions[i + axis] as number)
        high[axis] = Math.max(high[axis] as number, positions[i + axis] as number)
      }
    return { low, high }
  }

  it('stand inside their blockouts, on the same floor, but where the level moves them', () => {
    for (const prop of MODELLED) {
      const { low, high } = boundsOf(prop.id)
      const slack = prop.fit?.offset === undefined ? 0.002 : 0.3
      for (const axis of [0, 1, 2]) {
        expect(low[axis] as number, `${prop.id} axis ${axis}`).toBeGreaterThanOrEqual(
          (prop.min[axis] as number) - slack,
        )
        expect(high[axis] as number, `${prop.id} axis ${axis}`).toBeLessThanOrEqual(
          (prop.max[axis] as number) + slack,
        )
      }
    }
  })

  it('fill their blockouts: the tightest axis is full and none is under 40% (the blockout is the right size for its model), but for the ones the old game stretched', () => {
    const thin: string[] = []
    for (const prop of MODELLED) {
      if (STRETCHED.includes(prop.id) || prop.fit?.scale !== undefined) continue
      const { low, high } = boundsOf(prop.id)
      const fill = [0, 1, 2].map(
        (axis) =>
          ((high[axis] as number) - (low[axis] as number)) /
          ((prop.max[axis] as number) - (prop.min[axis] as number)),
      )
      expect(Math.max(...fill), prop.id).toBeGreaterThan(0.95)
      if (Math.min(...fill) < 0.4) thin.push(`${prop.id} ${fill.map((f) => f.toFixed(2)).join(' ')}`)
    }
    expect(thin).toEqual([])
  })
})
