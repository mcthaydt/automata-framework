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
    expect([PLACES[0], second].map((place) => place && placeInfo(place, '/no/such/game'))).toEqual([
      {
        id: 'itch',
        name: 'itch.io',
        asks: PLACES[0]?.asks,
        note: PLACES[0]?.note,
        afterNote: PLACES[0]?.afterNote,
        makePage: PLACES[0]?.makePage,
        signIn: true,
      },
      { id: 'host', name: 'My web host', asks: second.asks, signIn: false },
    ])
  })

  it('hands the page what a game already holds, so the person types it once', () => {
    const place: Place = {
      id: 'host',
      name: 'My web host',
      asks: [],
      put: async () => ({ ok: true, link: 'https://example.com/game' }),
      known: (root) => ({ address: `${root}.example.com` }),
    }
    expect(placeInfo(place, 'sam')).toMatchObject({ known: { address: 'sam.example.com' } })
  })
})
