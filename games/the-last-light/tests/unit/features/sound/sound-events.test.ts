import type { SimEvent } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { soundEventsOf } from '#src/features/sound/sound-events.ts'

// The sim says what happened by its type; the audio rows answer a type. A few things the type alone cannot say (which
// cutscene, which mode, which hotspot) get the old game's names, added after the sim's own events.

const event = (type: string, payload: unknown): SimEvent => ({ type, payload }) as SimEvent
const typesOf = (events: readonly SimEvent[]): string[] => soundEventsOf(events).map((each) => each.type)

describe('soundEventsOf', () => {
  it('names a cutscene by its id', () => {
    expect(typesOf([event('cutscene.started', { id: 'opening', start: 0, end: 90 })])).toEqual([
      'cutscene.opening',
    ])
  })

  it('names a mode change by who changed and to what', () => {
    expect(typesOf([event('systems.mode', { agent: 'nurse', from: 'patrol', to: 'hunt' })])).toEqual([
      'agent.nurse.hunt',
    ])
  })

  it('names a noise by its kind, and keeps where it was made', () => {
    const [noise] = soundEventsOf([event('systems.noise', { at: { x: 1, z: 2 }, loudness: 3, kind: 'buzz' })])
    expect(noise?.type).toBe('noise.buzz')
    expect(noise?.payload).toMatchObject({ at: { x: 1, z: 2 } })
  })

  it('names a use by the hotspot it was made at', () => {
    expect(
      typesOf([
        event('puzzle.said', { action: 'closetDoor.unlock', at: 'closetDoor', line: 'x', gained: [] }),
      ]),
    ).toEqual(['use.closetDoor'])
  })

  it('says Ada hid when a use sent her into hiding, and not when it did not', () => {
    expect(typesOf([event('interact.used', { at: 'screen', hid: true })])).toEqual(['game.hide'])
    expect(typesOf([event('interact.used', { at: 'bed', hid: false })])).toEqual([])
  })

  it('adds nothing for an event with no derived name, and keeps the order of those it does', () => {
    expect(
      typesOf([event('nav.arrived', {}), event('systems.mode', { agent: 'nurse', from: 'a', to: 'b' })]),
    ).toEqual(['agent.nurse.b'])
  })
})
