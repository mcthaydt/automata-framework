// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import facts from 'virtual:framework/facts'
import example from 'virtual:framework/home-example'
import { createSim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { BAR, BLOCK, SPINNER, stateAt, WORLD } from '#src/features/home/shapes-model.ts'
import game from '../../../../examples/2d/shapes/shapes-rects.ts'

// Home draws the shapes example beside its code. The drawing is not the framework running, so this holds it to the real
// thing: the example's own sim runs headless, and at every tick its rectangles must be where `stateAt` puts them.
const TICKS = 2500
const repo = resolve(process.cwd(), '..')
const source = readFileSync(resolve(repo, 'examples/2d/shapes/shapes-rects.ts'), 'utf8')

async function realStates() {
  const sim = await createSim({ seed: game.sim.seed, plugins: game.sim.plugins })
  try {
    game.sim.setup?.(sim)
    const components = new Map(
      game.sim.plugins.flatMap((plugin) => plugin.components).map((each) => [each.id, each]),
    )
    const of = (id: string) => components.get(id)!
    const read = () => ({
      blocks: sim.query(of('block')).map((entity) => entity.get(of('block'))),
      bar: sim.query(of('bar')).map((entity) => entity.get(of('bar'))),
      spinner: sim.query(of('spinner')).map((entity) => entity.get(of('spinner'))),
    })
    const states = [read()]
    for (let tick = 1; tick <= TICKS; tick++) {
      sim.step([])
      states.push(read())
    }
    return states
  } finally {
    sim.dispose()
  }
}

describe("Home's shapes drawing against the example's real sim", () => {
  it('has a rectangle for every entity the example spawns, and no other', async () => {
    const [first] = await realStates()
    expect(first!.blocks).toHaveLength(stateAt(0).blocks.length)
    expect(first!.bar).toHaveLength(1)
    expect(first!.spinner).toHaveLength(1)
  })

  it('puts every block, the bar and the spinner where the sim puts them, at every tick', async () => {
    const states = await realStates()
    for (let tick = 0; tick <= TICKS; tick++) {
      const real = states[tick]!
      const drawn = stateAt(tick)
      real.blocks.forEach((block, index) => {
        expect(drawn.blocks[index], `block ${index} at tick ${tick}`).toEqual({ x: block.x, y: block.y })
      })
      expect(drawn.bar, `bar at tick ${tick}`).toBe(real.bar[0]!.x)
      // The sim stores the angle in 32 bits and adds 0.05 each tick; the drawing computes it in one step.
      expect(Math.abs(drawn.angle - Number(real.spinner[0]!.angle)), `spinner at tick ${tick}`).toBeLessThan(
        0.01,
      )
    }
  })

  it("ends where the Checks table says: the hash the real sim has after the golden's ticks", async () => {
    const sim = await createSim({ seed: game.sim.seed, plugins: game.sim.plugins })
    try {
      game.sim.setup?.(sim)
      for (let tick = 0; tick < facts.golden.ticks; tick++) sim.step([])
      expect(sim.hash()).toBe(facts.golden.hash)
    } finally {
      sim.dispose()
    }
  })

  it('is the example Home shows beside its code', () => {
    expect(`${example.dir}/${example.file}`).toBe('examples/2d/shapes/shapes-rects.ts')
    expect(game.id).toBe('shapes-rects')
  })

  it("draws the bar and the spinner where the example's setup puts them", () => {
    expect(source).toContain(`sim.spawn([[Bar, { x: 0, y: ${BAR.y} }]])`)
    expect(source).toContain(`sim.spawn([[Spinner, { x: ${SPINNER.x}, y: ${SPINNER.y}, angle: 0 }]])`)
    expect(game.size).toEqual(WORLD)
  })

  it("draws each rectangle in the size and colour of the example's view", () => {
    const hex = (value: string) => `0x${value.slice(1)}`
    expect(source).toContain(`rect({ w: ${BLOCK.size}, h: ${BLOCK.size}, color: ${hex(BLOCK.color)} })`)
    expect(source).toContain(
      `rect({ w: ${BAR.w}, h: ${BAR.h}, color: ${hex(BAR.color)}, anchor: { x: 0, y: 0.5 } })`,
    )
    expect(source).toContain(`rect({ w: ${SPINNER.w}, h: ${SPINNER.h}, color: ${hex(SPINNER.color)} })`)
  })
})
