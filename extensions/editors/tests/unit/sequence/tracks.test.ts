import { describe, expect, it } from 'vitest'
import { addableRows, endOf, rows, timeOf, timePath } from '#src/features/sequence/tracks.ts'

const script = {
  id: 'gate',
  duration: 10,
  camera: [
    { t: 0, pos: [0, 1, 0], look: [1, 1, 0] },
    { t: 4, pos: [0, 1, 2], look: [1, 1, 2] },
  ],
  actor: [
    { who: 'keeper', t: 0, x: 1, z: 1 },
    { who: 'keeper', t: 2, x: 3, z: 1 },
    { who: 'guard', t: 1, x: 5, z: 5 },
  ],
  caption: [{ t: 1, until: 3, line: 'keeper.hi' }],
  sound: [{ t: 2, kind: 'creak' }],
  doors: [{ t: 3, door: 'gate', open: 1 }],
  cues: [{ at: 2, who: 'keeper', clip: 'wave' }],
  shake: [[5, 6, 0.1]],
  flicker: [[6, 7]],
  fade: [{ t: 9, value: 1 }],
  states: [{ t: 1, state: 'gate.open' }],
} as const

describe('rows', () => {
  it('has one row per track the scene uses, in the spec’s order, and one per actor', () => {
    expect(rows(script as never, true).map((row) => [row.track, row.words])).toEqual([
      ['camera', 'Camera'],
      ['actor', 'Keeper'],
      ['actor', 'Guard'],
      ['caption', 'Words on screen'],
      ['sound', 'Sounds'],
      ['doors', 'Doors'],
      ['cues', 'Clips'],
      ['shake', 'Shake'],
      ['flicker', 'Flicker'],
      ['fade', 'Fade'],
    ])
  })

  it('marks each key by its time, and an actor’s keys by their place in the whole list', () => {
    const [camera, keeper, guard] = rows(script as never, true)
    expect(camera?.marks.map((mark) => [mark.index, mark.t])).toEqual([
      [0, 0],
      [1, 4],
    ])
    expect(keeper?.marks.map((mark) => mark.index)).toEqual([0, 1])
    expect(guard?.marks.map((mark) => mark.index)).toEqual([2])
  })

  it('puts a second key at the same time in its own lane, so both can be tapped', () => {
    const two = { ...script, camera: [script.camera[0], { ...script.camera[1], t: 0 }] }
    const [camera] = rows(two as never, true)
    expect(camera?.marks.map((mark) => mark.lane)).toEqual([0, 1])
  })

  it('gives a bar its end, for words on screen, a shake and a flicker', () => {
    const all = rows(script as never, true)
    const bar = (track: string) => all.find((row) => row.track === track)?.marks[0]
    expect(bar('caption')).toMatchObject({ t: 1, until: 3 })
    expect(bar('shake')).toMatchObject({ t: 5, until: 6 })
    expect(bar('flicker')).toMatchObject({ t: 6, until: 7 })
    expect(bar('cues')).toMatchObject({ t: 2 })
  })

  it('says which rows only work in 3D games, while still listing them', () => {
    const only3d = rows(script as never, true)
      .filter((row) => row.only3d)
      .map((row) => row.track)
    expect(only3d).toEqual(['doors', 'flicker'])
    expect(rows(script as never, false).some((row) => row.only3d)).toBe(false)
  })

  it('never lists the file’s own bookkeeping as a row', () => {
    expect(rows(script as never, true).map((row) => row.track)).not.toContain('states')
  })
})

describe('time accessors', () => {
  it('know which key holds the time, and where to write it', () => {
    expect(timeOf('camera', script.camera[1])).toBe(4)
    expect(timeOf('cues', script.cues[0])).toBe(2)
    expect(timeOf('shake', script.shake[0])).toBe(5)
    expect(endOf('shake', script.shake[0])).toBe(6)
    expect(endOf('caption', script.caption[0])).toBe(3)
    expect(endOf('camera', script.camera[0])).toBeUndefined()
    expect(timePath('camera', 1)).toEqual(['camera', 1, 't'])
    expect(timePath('cues', 0)).toEqual(['cues', 0, 'at'])
    expect(timePath('shake', 0)).toEqual(['shake', 0, 0])
    expect(timePath('shake', 0, true)).toEqual(['shake', 0, 1])
    expect(timePath('flicker', 2, true)).toEqual(['flicker', 2, 1])
    expect(timePath('caption', 0, true)).toEqual(['caption', 0, 'until'])
  })
})

describe('addableRows', () => {
  it('offers the tracks the scene does not use yet, never Sounds, and marks 3D-only ones in a 2D game', () => {
    const offered = addableRows(
      { id: 'x', duration: 5, camera: [{ t: 0, pos: [0, 0, 0], look: [0, 0, 1] }] } as never,
      true,
    )
    expect(offered.map((row) => row.track)).not.toContain('sound')
    expect(offered.find((row) => row.track === 'caption')).toEqual({
      track: 'caption',
      words: 'Words on screen',
      only3d: false,
    })
    expect(offered.find((row) => row.track === 'doors')?.only3d).toBe(true)
  })
})
