import { PuzzleState } from '@automata/puzzle/sim'
import { CarriedLight, LightDry, SystemsEnv } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { TICK_HZ } from '#src/shared/constants.ts'
import { boot, type Game } from '#src/testing/harness.ts'

// The hand lamp over the systems' carried light: Ada can switch it only once she holds it; one fill gives the file's 40 s, two
// fills cap at twice that, and a lit lamp that runs dry goes out once and says so. The numbers are the file's.

const HAS_LAMP = ['handLamp', 'paraffin']

/** A game where Ada already holds the lamp and a bottle (the puzzle is not what these tests are about). */
async function withLamp(): Promise<Game> {
  const game = await boot()
  game.sim.resource(PuzzleState).items.push(...HAS_LAMP)
  game.hold(0.05)
  return game
}
const light = (game: Game) => [...game.sim.query(CarriedLight)].map((carrier) => carrier.get(CarriedLight))

describe('the hand lamp', () => {
  it('does nothing before she has it: no light to switch, nothing said', async () => {
    const game = await boot()
    game.lamp()
    expect(light(game)).toEqual([])
    expect(game.events(LightDry)).toEqual([])
  })

  it('is given to her unlit, with no fuel, the tick she holds the lamp', async () => {
    const game = await withLamp()
    expect(light(game)).toEqual([expect.objectContaining({ lit: false, fuelTicks: 0 })])
  })

  it('refuses to light with no fuel, saying so once', async () => {
    const game = await withLamp()
    game.lamp()
    expect(game.events(LightDry)).toHaveLength(1)
    expect(light(game)[0]?.lit).toBe(false)
  })

  it('fills by the file’s 40 s, lit; the paraffin is used up', async () => {
    const game = await withLamp()
    game.combine('handLamp', 'paraffin')
    expect(light(game)[0]).toMatchObject({ lit: true })
    expect(light(game)[0]?.fuelTicks).toBeGreaterThan(39 * TICK_HZ)
    expect(game.items()).not.toContain('paraffin')
  })

  it('two fills cap at twice the fill', async () => {
    const game = await withLamp()
    game.combine('handLamp', 'paraffin')
    game.sim.resource(PuzzleState).items.push('paraffin')
    game.combine('handLamp', 'paraffin')
    game.sim.resource(PuzzleState).items.push('paraffin')
    game.combine('handLamp', 'paraffin')
    expect(light(game)[0]?.fuelTicks).toBeLessThanOrEqual(80 * TICK_HZ)
    expect(light(game)[0]?.fuelTicks).toBeGreaterThan(79 * TICK_HZ)
  })

  it('lit for its fill, it goes out and says so once', async () => {
    const game = await withLamp()
    game.combine('handLamp', 'paraffin')
    game.hold(41)
    expect(light(game)[0]).toMatchObject({ lit: false, fuelTicks: 0 })
    expect(game.events(LightDry)).toHaveLength(1)
  })

  it('stays lit while the fuel lasts', async () => {
    const game = await withLamp()
    game.combine('handLamp', 'paraffin')
    game.hold(10)
    expect(light(game)[0]?.lit).toBe(true)
    expect(light(game)[0]?.fuelTicks).toBeLessThan(31 * TICK_HZ)
  })
})

describe('the lights the creature’s senses read', () => {
  const lights = (game: Game) => game.sim.resource(SystemsEnv).lights

  it('are the room’s four lamps until the lights go', async () => {
    const game = await boot()
    expect(lights(game)).toHaveLength(4)
    expect(
      lights(game)
        .map((light) => light.radius)
        .sort(),
    ).toEqual([1.7, 1.8, 2.6, 3.4])
  })

  it('are none after lights out, with the lamp unlit', async () => {
    const game = await boot()
    game.sim.resource(PuzzleState).facts.lightsOut = true
    game.hold(0.1)
    expect(lights(game)).toEqual([])
  })

  it('are Ada’s pool alone, one pool however long it burns, at the file’s radius', async () => {
    const game = await withLamp()
    game.sim.resource(PuzzleState).facts.lightsOut = true
    game.combine('handLamp', 'paraffin')
    game.hold(5)
    expect(lights(game)).toHaveLength(1)
    expect(lights(game)[0]?.radius).toBe(2.2)
  })
})
