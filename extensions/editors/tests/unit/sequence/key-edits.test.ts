import type { CutsceneScript } from '@automata/cutscenes/sim'
import { describe, expect, it } from 'vitest'
import {
  addKeyEdits,
  bounds,
  durationEdits,
  moveEdits,
  removeKeyEdit,
  retimeEdit,
  snap,
} from '#src/features/sequence/key-edits.ts'

const script = {
  id: 'gate',
  duration: 10,
  camera: [
    { t: 0, pos: [0, 1, 0], look: [1, 1, 0] },
    { t: 4, pos: [0, 1, 2], look: [1, 1, 2] },
    { t: 8, pos: [0, 1, 4], look: [1, 1, 4] },
  ],
  actor: [
    { who: 'keeper', t: 0, x: 1, z: 1 },
    { who: 'guard', t: 1, x: 5, z: 5 },
    { who: 'keeper', t: 3, x: 3, z: 1 },
    { who: 'guard', t: 6, x: 5, z: 7 },
  ],
  caption: [{ t: 1, until: 3, line: 'keeper.hi' }],
  cues: [{ at: 2, who: 'keeper', clip: 'wave' }],
  shake: [[4, 6, 0.1]],
  fade: [{ t: 9, value: 1 }],
} as unknown as CutsceneScript

const state = {
  camera: { pos: [1.234, 1.5, 2.345], look: [3, 1.5, 4] },
  actors: { keeper: { x: 2, z: 3, facing: 90 } },
  fade: 0.46,
}

describe('snap', () => {
  it('rounds to a tenth of a second and stays inside the scene', () => {
    expect(snap(1.26, 10)).toBe(1.3)
    expect(snap(-3, 10)).toBe(0)
    expect(snap(12, 10)).toBe(10)
  })
})

describe('bounds', () => {
  it('stops a camera key at its neighbours, so the file never goes back in time', () => {
    expect(bounds(script, 'camera', 1)).toEqual([0, 8])
    expect(bounds(script, 'camera', 0)).toEqual([0, 4])
    expect(bounds(script, 'camera', 2)).toEqual([4, 10])
  })
  it('stops an actor’s key at that actor’s neighbours, not the others’', () => {
    expect(bounds(script, 'actor', 2)).toEqual([0, 10])
    expect(bounds(script, 'actor', 1)).toEqual([0, 6])
    expect(bounds(script, 'actor', 0)).toEqual([0, 3])
  })
  it('lets any other key go anywhere in the scene', () => {
    expect(bounds(script, 'caption', 0)).toEqual([0, 10])
  })
})

describe('retimeEdit', () => {
  it('writes the new time at the track’s own place, and nothing when it did not change', () => {
    expect(retimeEdit(script, 'camera', 1, 5.04)).toEqual({
      keyPath: ['camera', 1, 't'],
      expected: 4,
      set: 5,
    })
    expect(retimeEdit(script, 'camera', 1, 4.02)).toBeUndefined()
  })
  it('stops a camera key at the next one’s time', () => {
    expect(retimeEdit(script, 'camera', 1, 9)).toEqual({ keyPath: ['camera', 1, 't'], expected: 4, set: 8 })
  })
  it('writes a clip’s time at `at`, and a shake’s start and end at index 0 and 1', () => {
    expect(retimeEdit(script, 'cues', 0, 3)).toEqual({ keyPath: ['cues', 0, 'at'], expected: 2, set: 3 })
    expect(retimeEdit(script, 'shake', 0, 3)).toEqual({ keyPath: ['shake', 0, 0], expected: 4, set: 3 })
    expect(retimeEdit(script, 'shake', 0, 7, true)).toEqual({ keyPath: ['shake', 0, 1], expected: 6, set: 7 })
  })
  it('keeps a bar’s end after its start', () => {
    expect(retimeEdit(script, 'caption', 0, 0.5, true)).toEqual({
      keyPath: ['caption', 0, 'until'],
      expected: 3,
      set: 1.1,
    })
  })
})

describe('moveEdits', () => {
  it('slides a whole bar, keeping its length', () => {
    expect(moveEdits(script, 'caption', 0, 4)).toEqual([
      { keyPath: ['caption', 0, 'until'], expected: 3, set: 6 },
      { keyPath: ['caption', 0, 't'], expected: 1, set: 4 },
    ])
  })
  it('stops a bar at the end of the scene', () => {
    const edits = moveEdits(script, 'caption', 0, 9.5)
    expect(edits).toContainEqual({ keyPath: ['caption', 0, 't'], expected: 1, set: 8 })
    expect(edits).toContainEqual({ keyPath: ['caption', 0, 'until'], expected: 3, set: 10 })
  })
  it('does nothing for a drag that ends where it started', () => {
    expect(moveEdits(script, 'caption', 0, 1)).toEqual([])
    expect(moveEdits(script, 'camera', 1, 4)).toEqual([])
  })
  it('moves a single key like retimeEdit', () => {
    expect(moveEdits(script, 'camera', 1, 6)).toEqual([{ keyPath: ['camera', 1, 't'], expected: 4, set: 6 }])
  })
})

describe('addKeyEdits', () => {
  it('adds a camera key where the shot is, in time order', () => {
    expect(addKeyEdits(script, 'camera', 5, state)).toEqual([
      {
        keyPath: ['camera'],
        insert: { t: 5, pos: [1.23, 1.5, 2.35], look: [3, 1.5, 4] },
        at: 2,
      },
    ])
  })
  it('adds an actor’s key where that actor is, after that actor’s earlier keys', () => {
    expect(addKeyEdits(script, 'actor', 2, state, { who: 'keeper' })).toEqual([
      { keyPath: ['actor'], insert: { who: 'keeper', t: 2, x: 2, z: 3, facing: 90 }, at: 2 },
    ])
  })
  it('adds words on screen for a line, for two seconds or what is left', () => {
    expect(addKeyEdits(script, 'caption', 4, state, { name: 'shop.thanks' })).toEqual([
      { keyPath: ['caption'], insert: { t: 4, until: 6, line: 'shop.thanks' }, at: 1 },
    ])
    expect(addKeyEdits(script, 'caption', 9.5, state, { name: 'shop.thanks' })).toEqual([
      { keyPath: ['caption'], insert: { t: 9.5, until: 10, line: 'shop.thanks' }, at: 1 },
    ])
  })
  it('adds a shake, a fade at how dark it is now, and makes a missing track first', () => {
    expect(addKeyEdits({ ...script, shake: undefined }, 'shake', 2, state)).toEqual([
      { keyPath: ['shake'], insert: [[2, 2.5, 0.1]] },
    ])
    expect(addKeyEdits(script, 'fade', 2, state)).toEqual([
      { keyPath: ['fade'], insert: { t: 2, value: 0.5 }, at: 0 },
    ])
  })
  it('adds a clip at a time, for a person and a clip', () => {
    expect(addKeyEdits(script, 'cues', 5, state, { who: 'keeper', name: 'bow' })).toEqual([
      { keyPath: ['cues'], insert: { at: 5, who: 'keeper', clip: 'bow' }, at: 1 },
    ])
  })
  it('asks for a name when a key needs one it was not given', () => {
    expect(addKeyEdits(script, 'caption', 4, state)).toBeUndefined()
    expect(addKeyEdits(script, 'cues', 4, state, { who: 'keeper' })).toBeUndefined()
  })
})

describe('removeKeyEdit', () => {
  it('removes a key, but never the last camera key', () => {
    expect(removeKeyEdit(script, 'fade', 0)).toEqual({ keyPath: ['fade', 0], remove: true })
    expect(removeKeyEdit({ ...script, camera: script.camera.slice(0, 1) }, 'camera', 0)).toBeUndefined()
  })
})

describe('durationEdits', () => {
  it('sets the length and takes away what would be after the end, counting it', () => {
    const { edits, dropped } = durationEdits(script, 5)
    expect(edits[0]).toEqual({ keyPath: ['duration'], expected: 10, set: 5 })
    // the camera key at 8, the guard key at 6, the fade at 9, and the keeper’s... none; the shake ends at 6 → trimmed.
    expect(edits).toContainEqual({ keyPath: ['camera', 2], remove: true })
    expect(edits).toContainEqual({ keyPath: ['actor', 3], remove: true })
    expect(edits).toContainEqual({ keyPath: ['fade', 0], remove: true })
    expect(edits).toContainEqual({ keyPath: ['shake', 0, 1], expected: 6, set: 5 })
    expect(dropped).toBe(3)
  })
  it('removes later keys before earlier ones so the places stay right', () => {
    const { edits } = durationEdits(script, 0.5)
    const camera = edits
      .filter((edit) => edit.keyPath[0] === 'camera' && 'remove' in edit)
      .map((edit) => edit.keyPath[1])
    expect(camera).toEqual([2, 1])
  })
  it('only sets the length when nothing is after the end', () => {
    expect(durationEdits(script, 12)).toEqual({
      edits: [{ keyPath: ['duration'], expected: 10, set: 12 }],
      dropped: 0,
    })
  })
})
