import { describe, expect, it } from 'vitest'
import { PLACES, type Place, placeInfo } from '#src/features/editor/places/place.ts'

describe('PLACES', () => {
  it('puts itch.io first', () => {
    expect(PLACES[0]?.id).toBe('itch')
    expect(PLACES[0]?.name).toBe('itch.io')
  })

  it('describes a place to the page without its code: name, questions and whether it signs in', () => {
    const second: Place = {
      id: 'host',
      name: 'My web host',
      asks: [{ id: 'address', label: 'Where it goes', example: 'example.com/game' }],
      put: async () => ({ ok: true, link: 'https://example.com/game' }),
    }
    expect([PLACES[0], second].map((place) => place && placeInfo(place))).toEqual([
      { id: 'itch', name: 'itch.io', asks: PLACES[0]?.asks, note: PLACES[0]?.note, signIn: true },
      { id: 'host', name: 'My web host', asks: second.asks, signIn: false },
    ])
  })
})
