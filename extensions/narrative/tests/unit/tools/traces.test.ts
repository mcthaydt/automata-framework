// Traces: the solver's routes played in the sim with puzzle and narrative loaded, recording what the
// player is shown, in play order. The toy game is a drawer that gives a key, a door it opens (a conversation and a
// cutscene follow) and a storylet on the drawer.
import { describe, expect, it } from 'vitest'
import { play, shown, solverRoutes, traces } from '#src/features/tools/traces.ts'
import { toyTraceGame } from '#src/testing/toy-trace.ts'

describe('solverRoutes', () => {
  it('are the solver’s routes: the shortest, then one per distinct key-set', () => {
    const routes = solverRoutes(toyTraceGame().puzzle)
    expect(routes[0]).toMatchObject({ name: 'shortest', entry: 'start' })
    expect(routes[0]?.steps.map((s) => s.action)).toEqual(['drawer.open', 'door.unlock'])
  })
})

describe('play', () => {
  it('records the lines, items, storylets, conversation and cutscene a route shows, in play order', async () => {
    const game = toyTraceGame()
    const [route] = solverRoutes(game.puzzle)
    const trace = await play(game, route as NonNullable<typeof route>)
    expect(trace).toMatchObject({ route: 'shortest', entry: 'start', goal: true })
    expect(trace.events.map((e) => (e.kind === 'step' ? `step ${e.n} ${e.action}` : e.kind))).toEqual([
      'step 1 drawer.open',
      'line',
      'item',
      'line',
      'step 2 door.unlock',
      'line',
      'dialogue',
      'cutscene',
    ])
    expect(
      trace.events.filter((e) => e.kind === 'line').map((e) => e.kind === 'line' && [e.id, e.storylet]),
    ).toEqual([
      ['toy.drawer', undefined],
      ['toy.murmur', 'st.murmur'],
      ['toy.door', undefined],
    ])
    expect(trace.events.find((e) => e.kind === 'item')).toMatchObject({
      item: 'key',
      name: 'toy.item.key.name',
      text: 'toy.item.key',
    })
    expect(trace.events.find((e) => e.kind === 'dialogue')).toMatchObject({
      id: 'meet',
      said: ['toy.hello', 'toy.ask'],
    })
    expect(trace.events.find((e) => e.kind === 'cutscene')).toMatchObject({
      id: 'dawn',
      duration: 8,
      captions: ['toy.dawn.1'],
    })
    expect(shown(trace)).toEqual([
      'toy.drawer',
      'toy.item.key.name',
      'toy.item.key',
      'toy.murmur',
      'toy.door',
      'toy.hello',
      'toy.ask',
      'toy.dawn.1',
    ])
  })
  it('times each event in seconds of play, rising along the route', async () => {
    const game = toyTraceGame()
    const [route] = solverRoutes(game.puzzle)
    const trace = await play(game, route as NonNullable<typeof route>)
    const times = trace.events.map((e) => e.at)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times.at(-1)).toBeGreaterThan(times[0] as number)
  })
  it('plays the same route to the same trace twice', async () => {
    const game = toyTraceGame()
    const [route] = solverRoutes(game.puzzle)
    const a = await play(game, route as NonNullable<typeof route>)
    const b = await play(game, route as NonNullable<typeof route>)
    expect(b).toEqual(a)
  })
  it('stops after `upTo` steps, then takes one more step if asked (a hint probe), and is not at the goal', async () => {
    const game = toyTraceGame()
    const [route] = solverRoutes(game.puzzle)
    const r = route as NonNullable<typeof route>
    const first = await play(game, r, { upTo: 1 })
    expect(first.goal).toBe(false)
    expect(first.events.filter((e) => e.kind === 'step')).toHaveLength(1)
    const probe = await play(game, r, { upTo: 0, then: { action: 'door.locked', at: 'door' } })
    expect(probe.events.filter((e) => e.kind === 'line').map((e) => e.kind === 'line' && e.id)).toEqual([
      'toy.locked',
    ])
  })
  it('records a message that is no line record as unrecorded', async () => {
    const game = toyTraceGame({ records: [] })
    const [route] = solverRoutes(game.puzzle)
    const trace = await play(game, route as NonNullable<typeof route>, { upTo: 1 })
    expect(trace.events.filter((e) => e.kind === 'unrecorded').length).toBeGreaterThan(0)
  })
  it('refuses a systemic step the game gives no orders for', async () => {
    const game = toyTraceGame()
    await expect(
      play(game, {
        name: 'x',
        entry: 'start',
        steps: [{ action: 'systemic:leak', at: 'systemic', systemic: true }],
      }),
    ).rejects.toThrow(/systemic:leak/)
  })
})

describe('traces', () => {
  it('plays every route', async () => {
    const game = toyTraceGame()
    const all = await traces(game)
    expect(all.map((t) => t.route)).toEqual(solverRoutes(game.puzzle).map((r) => r.name))
  })
})
