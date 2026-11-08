import type { StepResult } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { stepBus } from '#src/app/step-bus.ts'

const step = (tick: number, ...types: string[]): StepResult =>
  ({
    tick,
    events: types.map((type) => ({ type, payload: { tick } })),
    render: { added: [], changed: [], removed: [] },
    rejected: [],
  }) as unknown as StepResult

// Watch asks the game which mode each character is in. The debug overlay answers from the presentation bus's `sim.step`
// fact, which a game with a core level does not hand to a renderer `setup`, so the story feeds the same fact itself.
describe('the step bus', () => {
  it('tells a listener each step as the tick and its events', () => {
    const bus = stepBus()
    const heard: unknown[] = []
    bus.subscribe('sim.step', (fact) => heard.push(fact))
    bus.apply(step(7, 'systems.mode'))
    expect(heard).toEqual([{ tick: 7, events: [{ type: 'systems.mode', payload: { tick: 7 } }] }])
  })

  it('keeps quiet to a listener of another fact, and to one that left', () => {
    const bus = stepBus()
    const other: unknown[] = []
    const left: unknown[] = []
    bus.subscribe('render.filter.dropped', (fact) => other.push(fact))
    const leave = bus.subscribe('sim.step', (fact) => left.push(fact))
    leave()
    bus.apply(step(1, 'systems.mode'))
    expect(other).toEqual([])
    expect(left).toEqual([])
  })
})
