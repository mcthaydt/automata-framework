import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CutsceneState } from '@automata/cutscenes/sim'
import { PuzzleState } from '@automata/puzzle/sim'
import { Hide, SystemsMode, SystemsScene, SystemsState } from '@automata/systems/sim'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { Night } from '#src/features/night/night.resource.ts'
import { nightHooks } from '#src/features/night/night-hooks.ts'
import { TICK_HZ } from '#src/shared/constants.ts'
import { boot } from '#src/testing/harness.ts'

// The night: every call the creature's file makes has an answer in code (audit 7), lights out wakes her at the far end of
// the corridor, the vigil is over after its tuned seconds unless she is hunting, and Ada's footsteps are noise she hears.

/** The calls the creature's file makes. */
const callsIn = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(callsIn)
    : typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, child]) =>
          key === 'call' && typeof child === 'string' ? [child] : callsIn(child),
        )
      : []

/** The calls the game answers: every hook the creature's file may name, built with nothing behind them. */
const calls = Object.keys(
  nightHooks({
    checkpoint: () => undefined,
    start: () => undefined,
    playing: () => false,
    caught: () => undefined,
  }),
)

describe('the night', () => {
  it('answers every call the creature’s file makes (stop is built in)', () => {
    const file = parse(
      readFileSync(join(import.meta.dirname, '../../../../content/systems/prologue.toml'), 'utf8'),
    )
    const unanswered = [...new Set(callsIn(file))].filter(
      (call) => call !== 'stop' && !(calls as readonly string[]).includes(call),
    )
    expect(unanswered).toEqual([])
  })

  it('loads the creature on the first tick, dormant', async () => {
    const game = await boot()
    expect(game.sim.resource(SystemsScene).def).not.toBeNull()
    expect(game.sim.resource(SystemsState).agents.nurse?.mode).toBe('dormant')
  })

  it('wakes her at the far end of the corridor when Bed 04 is made, and starts the vigil clock', async () => {
    const game = await boot()
    // The rule `lightsOut` fires when the bed is made and the lights have not yet gone.
    game.sim.resource(PuzzleState).facts.bedMade = true
    game.hold(0.2)
    expect(game.fact('lightsOut')).toBe(true)
    // She waits at the far end while the lights-out cutscene tells it, and the night's clock waits with her.
    expect(game.sim.resource(SystemsState).agents.nurse?.mode).toBe('dormant')
    expect(game.sim.resource(Night).vigil).toBe(0)
    for (let i = 0; i < 60 * 20 && game.sim.resource(CutsceneState).id !== null; i += 1) game.send([])
    game.hold(0.2)
    const nurse = game.sim.resource(SystemsState).agents.nurse
    expect(nurse?.mode).toBe('patrol')
    expect(game.events(SystemsMode)).toContainEqual(expect.objectContaining({ agent: 'nurse', to: 'patrol' }))
    expect(game.sim.resource(Night).vigil).toBeGreaterThan(0)
  })

  it('ends the vigil after its tuned seconds when Ada hides behind the screen', async () => {
    const game = await boot()
    game.sim.resource(PuzzleState).facts.bedMade = true
    game.send([{ type: Hide.id, payload: { spot: 'screen' } }])
    const seconds = game.sim.resource(SystemsScene).def?.tunables.vigil?.value ?? 35
    // The vigil's clock waits out the lights-out cutscene.
    for (let i = 0; i < 60 * 20 && game.sim.resource(CutsceneState).id !== null; i += 1) game.send([])
    game.hold(seconds - 3)
    expect(game.sim.resource(Night).over).toBe(false)
    game.hold(6)
    expect(game.sim.resource(Night).over).toBe(true)
    expect(seconds * TICK_HZ).toBeGreaterThan(0)
  })

  it('keeps the vigil going while she hunts or follows Ada, and ends it once she does neither', () => {
    // The hook alone, on a stand-in world: a figure in `mode` and a clock that has run past the tuned seconds.
    const run = (mode: string): boolean => {
      const night = { vigil: 10, over: false, step: 0 }
      const world = {
        ctx: { resource: () => night, dt: 1 / 60 },
        def: { tunables: { vigil: { value: 5 } } },
        state: { agents: { nurse: { mode } } },
      }
      nightHooks({
        checkpoint: () => undefined,
        start: () => undefined,
        playing: () => false,
        caught: () => undefined,
      }).vigil?.(world as never, null)
      return night.over
    }
    expect(run('hunt')).toBe(false)
    expect(run('follow')).toBe(false)
    expect(run('patrol')).toBe(true)
  })

  it('is the same hash twice through the night', async () => {
    const run = async () => {
      const game = await boot(7)
      game.sim.resource(PuzzleState).facts.bedMade = true
      game.hold(45)
      return game.sim.hash()
    }
    expect(await run()).toBe(await run())
  })
})
