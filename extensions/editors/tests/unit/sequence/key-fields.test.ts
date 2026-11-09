import type { CutsceneScript } from '@automata/cutscenes/sim'
import { describe, expect, it } from 'vitest'
import { keyFields, lensWords, NO_NAMES, sceneFields } from '#src/features/sequence/key-fields.ts'

const script = {
  id: 'gate',
  duration: 10,
  camera: [
    { t: 0, pos: [0, 1, 0], look: [1, 1, 0] },
    { t: 4, pos: [0, 1, 2], look: [1, 1, 2], lens: 28, ease: 'inOutCubic' },
  ],
  actor: [
    { who: 'keeper', t: 0, x: 1, z: 1 },
    { who: 'keeper', t: 3, at: 'gate', height: 0 },
  ],
  caption: [
    { t: 1, until: 3, line: 'keeper.hi' },
    { t: 4, until: 5, line: 'gone.line' },
  ],
  shake: [[4, 6, 0.1]],
  fade: [{ t: 9, value: 1 }],
} as unknown as CutsceneScript

const names = {
  ...NO_NAMES,
  lines: [{ id: 'keeper.hi', words: 'Welcome in. Mind the step.', file: 'gate' }],
  actors: ['keeper'],
  anchors: ['gate', 'player'],
}

const optionsOf = (field: unknown): { label: string }[] => (field as { options: { label: string }[] }).options
const labels = (track: never, index: number, given = names) =>
  keyFields(script, track, index, given).map((entry) => entry.field.label)

describe('keyFields', () => {
  it('says a camera key in the spec’s words, with the lens as a word', () => {
    expect(labels('camera' as never, 1)).toEqual([
      'When',
      'Stands at (across)',
      'Stands at (height)',
      'Stands at (along)',
      'Looks at (across)',
      'Looks at (height)',
      'Looks at (along)',
      'Lens, wide',
      'Arrives',
    ])
    expect(lensWords(28)).toBe('wide')
    expect(lensWords(50)).toBe('normal')
    expect(lensWords(85)).toBe('close')
  })

  it('shows a curve as “Moves (its own curve)” and keeps it; Moves smoothly removes it', () => {
    const arrives = keyFields(script, 'camera' as never, 1).find((entry) => entry.field.key === 'arrives')
    expect(arrives?.field).toMatchObject({ value: 'curve' })
    expect(optionsOf(arrives?.field).map((o) => o.label)).toContain('Moves (its own curve)')
    expect(arrives?.edits('curve')).toEqual([])
    expect(arrives?.edits('smooth')).toEqual([{ keyPath: ['camera', 1, 'ease'], remove: true }])
    expect(arrives?.edits('cut')).toEqual([{ keyPath: ['camera', 1, 'cut'], insert: true }])
  })

  it('writes a position component at its own index', () => {
    const stands = keyFields(script, 'camera' as never, 0).find(
      (entry) => entry.field.label === 'Stands at (height)',
    )
    expect(stands?.edits(2)).toEqual([{ keyPath: ['camera', 0, 'pos', 1], expected: 1, set: 2 }])
    expect(stands?.edits(1)).toEqual([])
  })

  it('offers a caption’s line by its words, and names a removed line in words, never its id', () => {
    const [, , which] = keyFields(script, 'caption' as never, 0, names)
    expect(optionsOf(which?.field)[0]?.label).toBe('Welcome in. Mind the step.')
    expect(which?.problem).toBeUndefined()
    const removed = keyFields(script, 'caption' as never, 1, names)[2]
    expect(removed?.problem).toBe('This step’s words were removed.')
    expect(JSON.stringify(removed?.field)).toContain('This step’s words were removed.')
    expect(removed?.edits('keeper.hi')).toEqual([
      { keyPath: ['caption', 1, 'line'], expected: 'gone.line', set: 'keeper.hi' },
    ])
  })

  it('puts the rare actor fields under More', () => {
    const fields = keyFields(script, 'actor' as never, 0, names)
    expect(fields.filter((entry) => entry.more === true).map((entry) => entry.field.label)).toEqual([
      'Height',
      'Shiver',
      'Detail',
      'Face',
      'Which picture',
    ])
    expect(fields.map((entry) => entry.field.label)).toContain('Across')
  })

  it('swaps a named place for a point and back', () => {
    const named = keyFields(script, 'actor' as never, 1, names).find((entry) => entry.field.key === 'where')
    expect(named?.field).toMatchObject({ value: 'gate' })
    expect(named?.edits('point')).toEqual([
      { keyPath: ['actor', 1, 'at'], remove: true },
      { keyPath: ['actor', 1, 'x'], insert: 0 },
      { keyPath: ['actor', 1, 'z'], insert: 0 },
    ])
    const point = keyFields(script, 'actor' as never, 0, names).find((entry) => entry.field.key === 'where')
    expect(point?.edits('player')).toEqual([
      { keyPath: ['actor', 0, 'at'], insert: 'player' },
      { keyPath: ['actor', 0, 'x'], remove: true },
      { keyPath: ['actor', 0, 'z'], remove: true },
    ])
  })

  it('writes a shake’s start, end and strength at their own indexes', () => {
    const [from, to, hard] = keyFields(script, 'shake' as never, 0)
    expect(from?.edits(3)).toEqual([{ keyPath: ['shake', 0, 0], expected: 4, set: 3 }])
    expect(to?.edits(7)).toEqual([{ keyPath: ['shake', 0, 1], expected: 6, set: 7 }])
    expect(hard?.edits(0.5)).toEqual([{ keyPath: ['shake', 0, 2], expected: 0.1, set: 0.5 }])
  })

  it('has no key names on screen', () => {
    for (const track of ['camera', 'actor', 'caption', 'shake', 'fade'] as const)
      for (const entry of keyFields(script, track as never, 0, names))
        expect(entry.field.label).not.toMatch(/\b(pos|look|alpha|lintAllow|t|until|ease|cut)\b/)
  })
})

describe('sceneFields', () => {
  it('has the length, the lens and whether it ends the game', () => {
    expect(sceneFields(script).map((entry) => entry.field.label)).toEqual([
      'Length',
      'Lens, normal',
      'Ends the game when it ends',
    ])
    expect(sceneFields(script)[2]?.edits('yes')).toEqual([{ keyPath: ['victory'], insert: true }])
  })
})

describe('facing', () => {
  it('is a dial in degrees over keys that store radians', () => {
    const turned = {
      ...script,
      actor: [{ who: 'keeper', t: 0, x: 1, z: 1, facing: Math.PI / 2 }],
    } as unknown as CutsceneScript
    const facing = keyFields(turned, 'actor' as never, 0, names).find((entry) => entry.field.key === 'facing')
    expect(facing?.field).toMatchObject({ value: 90, unit: '°' })
    expect(facing?.edits(180)).toEqual([
      { keyPath: ['actor', 0, 'facing'], expected: Math.PI / 2, set: Math.round(Math.PI * 1000) / 1000 },
    ])
  })
})
