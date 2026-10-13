import { moveCommand, ROOM } from '@af-examples/base-2d'
import { Transform2D } from '@mcthaydt/automata-physics/2d'
import type { Command, Sim, StepResult } from '@mcthaydt/automata-sim'
import { type Sprite, Texture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createBodiesSim } from './bodies-sim.ts'
import { bodiesLayer, type Drawn } from './layer.ts'
import { Drop, MAX_LOOSE, Prop, PropKind } from './sim/bodies.plugin.ts'

// The layer draws from the sim's RenderDelta alone, the way render-pixi will: it never reads the sim.
const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})

const textures = { crate: Texture.WHITE, stone: Texture.EMPTY }
const step = (sim: Sim, x: -1 | 0 | 1 = 0): StepResult => sim.step([moveCommand(sim, { x, jump: false })])
const sprites = (layer: ReturnType<typeof bodiesLayer>) => layer.view.children as Sprite[]

describe('bodiesLayer', () => {
  it('makes one sprite per loose body, with the crate or stone texture, in room pixels', async () => {
    const sim = await createBodiesSim(ROOM)
    sims.push(sim)
    const layer = bodiesLayer(ROOM.rows.length * ROOM.tileSize, textures)
    layer.apply?.(step(sim))
    expect(sprites(layer)).toHaveLength(7)
    expect(sprites(layer).filter((s) => s.texture === Texture.WHITE)).toHaveLength(4)
    expect(sprites(layer).filter((s) => s.texture === Texture.EMPTY)).toHaveLength(3)
    // Positions are whole pixels (y flipped: 192 px minus metres × 16), whatever Rapier's floats.
    const crate = sim
      .query(Prop, Transform2D)
      .find((body) => body.get(Prop).kind === PropKind.crate) as NonNullable<ReturnType<Sim['entity']>>
    const at = crate.get(Transform2D)
    const drawn = sprites(layer).map((s) => [s.x, s.y])
    expect(drawn).toContainEqual([Math.round(at.x * 16), Math.round(192 - at.y * 16)])
    for (const [x, y] of drawn) {
      expect(Number.isInteger(x)).toBe(true)
      expect(Number.isInteger(y)).toBe(true)
    }
  })

  it('moves sprites with their bodies, and forgets them on a reset', async () => {
    const sim = await createBodiesSim(ROOM)
    sims.push(sim)
    const layer = bodiesLayer(ROOM.rows.length * ROOM.tileSize, textures)
    layer.apply?.(step(sim))
    const before = sprites(layer).map((s) => s.y)
    for (let i = 0; i < 20; i++) layer.apply?.(step(sim))
    const after = sprites(layer).map((s) => s.y)
    expect(after).toHaveLength(7)
    // Everything starts in the air, so after a third of a second of falling some sprite is lower on screen.
    expect(after.some((y, i) => y > (before[i] as number))).toBe(true)
    layer.reset?.()
    expect(sprites(layer)).toHaveLength(0)
  })

  it('starts over on a resync delta, keeping only the bodies it lists', async () => {
    const sim = await createBodiesSim(ROOM)
    sims.push(sim)
    const layer = bodiesLayer(ROOM.rows.length * ROOM.tileSize, textures)
    const first = step(sim)
    layer.apply?.(first)
    expect(sprites(layer)).toHaveLength(7)
    const [one] = first.render.added.filter((row) => row.components[Prop.id] !== undefined)
    const resync: StepResult = {
      ...first,
      render: { resync: true, added: one ? [one] : [], changed: [], removed: [] },
    }
    layer.apply?.(resync)
    expect(sprites(layer)).toHaveLength(1)
  })

  it('reports how many bodies it drew and where the rightmost crate is', async () => {
    const sim = await createBodiesSim(ROOM)
    sims.push(sim)
    const drawn: Drawn[] = []
    const layer = bodiesLayer(ROOM.rows.length * ROOM.tileSize, textures, (d) => drawn.push(d))
    layer.apply?.(step(sim))
    // The crate stack starts at x = 6.5 m, 104 px.
    expect(drawn.at(-1)).toEqual({ count: 7, crateX: 104 })
  })

  it('drops the sprite of a body the sim removed', async () => {
    const sim = await createBodiesSim(ROOM)
    sims.push(sim)
    const layer = bodiesLayer(ROOM.rows.length * ROOM.tileSize, textures)
    // One drop a tick until the sim holds MAX_LOOSE bodies, then one more: the sim removes the oldest.
    for (let i = 0; i <= MAX_LOOSE - 7; i++) {
      const drop: Command = {
        tick: sim.tick,
        source: 0,
        seq: 0x80000000 + sim.tick,
        type: Drop.id,
        payload: {},
      }
      layer.apply?.(sim.step([moveCommand(sim, { x: 0, jump: false }), drop]))
    }
    expect(sim.query(Prop)).toHaveLength(MAX_LOOSE)
    expect(sprites(layer)).toHaveLength(MAX_LOOSE)
  })
})
