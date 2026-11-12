// `applyVerb` is what the verb system does for one `puzzle.verb`, callable by another system (the `interact`
// extension's use of a hotspot): the same verb applied either way says the same lines and leaves the same state.
import { createSim, defineCommand, definePlugin, defineSystem, type Sim } from '@automataframework/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  applyVerb,
  createPuzzlePlugin,
  loadPuzzle,
  type PuzzleOptions,
  type VerbPayload,
} from '#src/entries/sim.ts'
import { TOY } from '#src/testing/toy-room.ts'

const Load = defineCommand('test.load', z.strictObject({}))
const Apply = defineCommand(
  'test.apply',
  z.strictObject({
    at: z.string(),
    held: z.string().optional(),
    pair: z.tuple([z.string(), z.string()]).optional(),
  }) as z.ZodType<VerbPayload>,
)

const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})

/** A sim whose own system applies the verb it is sent, with the puzzle's own options. */
async function applier(options: PuzzleOptions = {}): Promise<Sim> {
  const sim = await createSim({
    seed: 7,
    plugins: [
      createPuzzlePlugin(options),
      definePlugin({
        name: 'applier',
        dependsOn: ['puzzle'],
        commands: [Load, Apply],
        systems: [
          defineSystem('applier.run', 'gameplay', (ctx) => {
            if (ctx.commands.of(Load).length > 0) loadPuzzle(ctx, TOY)
            for (const { payload } of ctx.commands.of(Apply)) applyVerb(ctx, payload, options)
          }),
        ],
      }),
    ],
  })
  sims.push(sim)
  sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'test.load', payload: {} }])
  return sim
}

const send = (sim: Sim, type: string, payload: object) =>
  sim.step([{ tick: sim.tick, source: 0, seq: 0, type, payload }])

describe('applyVerb', () => {
  it('says what the same verb says as a command', async () => {
    const byCommand = await applier()
    const bySystem = await applier()
    const verbs = [{ at: 'drawer' }, { at: 'drawer' }, { at: 'door', held: 'key' }]
    for (const verb of verbs) {
      const a = send(byCommand, 'puzzle.verb', verb)
      const b = send(bySystem, 'test.apply', verb)
      expect(b.events).toEqual(a.events)
      expect(b.events.length).toBeGreaterThan(0)
    }
    expect(bySystem.hash()).toBe(byCommand.hash())
  })

  it('runs the options it is given: a `call` effect reaches the game', async () => {
    const calls: string[] = []
    const sim = await applier({ calls: { glow: (_ctx, call) => calls.push(call.action) } })
    send(sim, 'puzzle.verb', { at: 'drawer' })
    send(sim, 'puzzle.verb', { at: 'drawer' })
    send(sim, 'test.apply', { at: 'combine', pair: ['shade', 'bulb'] })
    expect(calls).toEqual(['lamp'])
  })

  it('is ignored while the game says input is locked, as a command is', async () => {
    const sim = await applier({ locked: () => true })
    expect(send(sim, 'test.apply', { at: 'drawer' }).events).toEqual([])
  })
})
