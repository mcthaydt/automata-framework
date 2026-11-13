import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { placeOf, probeOf, worldLibraryOf } from '#src/app/place.ts'
import { SCENE_ZONES } from '#src/entries/index.ts'

const start = SCENE_ZONES[0] as string

describe('the place an example plays in', () => {
  it("builds the station's world from the set's own swatches, with no problem the level or the swatches cause", () => {
    const place = placeOf({ start }, worldLibraryOf(content))
    expect(place.world.problems).toEqual([])
    expect(place.world.pieces.length).toBeGreaterThan(0)
  })

  it("runs the example's few lines once, with the world, the level and the probe", () => {
    const seen: unknown[] = []
    const place = placeOf({ start, on: (context) => seen.push(context) }, worldLibraryOf(content))
    expect(seen).toEqual([place])
    expect(place.level.name).toBe('station')
  })

  it('answers a journey with the zone and the hour it was asked for, and nothing it cannot know yet', () => {
    const probe = probeOf({ start, time: 'night' })
    expect([probe.zone(), probe.time(), probe.fact('anything'), probe.carried()]).toEqual([
      start,
      'night',
      undefined,
      [],
    ])
    expect(probeOf({ start }).time()).toBe('day')
  })
})
