import type { Command, Sim, SimEvent, StepResult } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { stepOnce } from '#src/shared/runtime/loop/frame-loop.ts'
import type { PresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import type { GameRenderer } from '#src/shared/runtime/render/renderer.ts'

// FR.2 (Plus FE-D1): a listener that needs the tick an event happened on (feel's `hear(tick, events)`) gets it from the `sim.step`
// fact, published with `sim.events`. `sim.events` is unchanged, so no existing listener breaks.

const renderer: GameRenderer = { apply: () => {}, draw: () => {}, reset: () => {} }
const hit: SimEvent = { type: 'hit', payload: { power: 3 } } as unknown as SimEvent

function simAt(result: Partial<StepResult>): Sim {
  const full: StepResult = {
    tick: 0,
    events: [],
    render: { resync: false, added: [], changed: [], removed: [] },
    rejected: [],
    ...result,
  }
  return { tick: full.tick - 1, step: (_cmds: readonly Command[]) => full } as unknown as Sim
}

function recordingBus(): { bus: PresentationBus; published: { fact: string; value: unknown }[] } {
  const published: { fact: string; value: unknown }[] = []
  const bus = {
    publish: (fact: string, value: unknown) => {
      published.push({ fact, value })
    },
    subscribe: () => () => {},
    dispose: () => {},
  } as unknown as PresentationBus
  return { bus, published }
}

describe('stepOnce', () => {
  it('publishes sim.events and then sim.step with the step’s tick and the same events', () => {
    const { bus, published } = recordingBus()
    stepOnce(simAt({ tick: 7, events: [hit] }), () => [], renderer, bus)
    expect(published).toEqual([
      { fact: 'sim.events', value: [hit] },
      { fact: 'sim.step', value: { tick: 7, events: [hit] } },
    ])
  })

  it('publishes neither when the step emitted no events', () => {
    const { bus, published } = recordingBus()
    stepOnce(simAt({ tick: 8, events: [] }), () => [], renderer, bus)
    expect(published).toEqual([])
  })
})
