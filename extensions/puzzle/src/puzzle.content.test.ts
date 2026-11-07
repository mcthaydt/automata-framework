// The `puzzle` content kind (M6 spec §4.5, §6): the four converted scenes compile, and each reference a def makes is
// checked when content compiles, at its path, so the compiler names the file and line.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContent } from '@automata/content'
import { Effect, Either } from 'effect'
import { stringify } from 'smol-toml'
import { afterEach, describe, expect, it } from 'vitest'
import { puzzleContent, puzzleSchema } from './puzzle.content'
import { SCENE_CALLS, SCENES, scenePuzzle } from './testing/converted-puzzles'
import { TOY } from './testing/toy-room'

const ALL = { calls: ['glow'], extensions: ['systems', 'cutscenes', 'narrative'] } as const
const issues = (def: unknown, options: Parameters<typeof puzzleSchema>[0] = ALL) => {
  const result = puzzleSchema(options).safeParse(def)
  return result.success ? [] : result.error.issues.map((i) => ({ path: i.path, message: i.message }))
}
const withAction = (patch: object) => ({
  ...TOY,
  actions: [{ ...TOY.actions[0], ...patch }, ...TOY.actions.slice(1)],
})

describe('puzzleSchema', () => {
  it('takes the four scenes and the toy room', () => {
    for (const scene of SCENES)
      expect(issues(scenePuzzle(scene), { ...ALL, calls: SCENE_CALLS }), scene).toEqual([])
    expect(issues(TOY)).toEqual([])
  })

  it('fails an undeclared item in a use, a give, a take, a has and an entry', () => {
    expect(issues(withAction({ use: 'spoon' }))).toEqual([
      { path: ['actions', 0, 'use'], message: 'no item "spoon" in items' },
    ])
    expect(issues(withAction({ then: [{ give: 'spoon' }] }))).toEqual([
      { path: ['actions', 0, 'then', 0, 'give'], message: 'no item "spoon" in items' },
    ])
    expect(issues(withAction({ when: [{ not: { has: 'spoon' } }] }))).toEqual([
      { path: ['actions', 0, 'when', 0], message: 'no item "spoon" in items' },
    ])
    expect(issues({ ...TOY, entry: [{ name: 'start', items: ['spoon'] }] })).toEqual([
      { path: ['entry', 0, 'items', 0], message: 'no item "spoon" in items' },
    ])
  })

  it('fails a noise at an undeclared hotspot and a call the game does not declare', () => {
    expect(issues(withAction({ then: [{ noise: { at: 'attic', loudness: 1, kind: 'bang' } }] }))).toEqual([
      { path: ['actions', 0, 'then', 0, 'noise', 'at'], message: 'no hotspot "attic" in hotspots' },
    ])
    expect(issues(TOY, { ...ALL, calls: [] })).toEqual([
      { path: ['actions', 6, 'then', 3, 'call'], message: 'the game declares no call "glow"' },
    ])
  })

  it('fails an effect whose extension the game does not register', () => {
    const def = withAction({
      then: [
        { cutscene: 'intro' },
        { dialogue: 'nurse' },
        { noise: { at: 'door', loudness: 1, kind: 'bang' } },
      ],
    })
    expect(issues(def, { calls: ['glow'], extensions: [] })).toEqual([
      { path: ['actions', 0, 'then', 0], message: 'a cutscene effect needs the cutscenes extension' },
      { path: ['actions', 0, 'then', 1], message: 'a dialogue effect needs the narrative extension' },
      { path: ['actions', 0, 'then', 2], message: 'a noise effect needs the systems extension' },
      // The toy room's own knock makes a noise too.
      { path: ['actions', 5, 'then', 0], message: 'a noise effect needs the systems extension' },
    ])
  })
})

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('names the file and line of a bad reference when content compiles', async () => {
  root = mkdtempSync(join(tmpdir(), 'puzzle-content-'))
  mkdirSync(join(root, 'content', 'puzzles'), { recursive: true })
  writeFileSync(
    join(root, 'content', 'puzzles', 'toy.toml'),
    stringify(withAction({ use: 'spoon' }) as never),
  )
  const result = await Effect.runPromise(
    Effect.either(compileContent({ root, schemas: [puzzleContent(ALL)] })),
  )
  if (Either.isRight(result)) throw new Error('the compile passed')
  const failure = result.left
  if (failure._tag !== 'ContentCompileFailed') throw new Error(failure.message)
  expect(failure.diagnostics).toEqual([
    expect.objectContaining({
      file: 'content/puzzles/toy.toml',
      line: expect.any(Number),
      message: expect.stringContaining('no item "spoon" in items'),
    }),
  ])
  expect(failure.diagnostics[0]?.line).toBeGreaterThan(1)
})
