import type { PuzzleDef } from '@automata/puzzle/sim'
import { build } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { canFinish } from '#src/features/schematic/puzzle/solve.ts'
import { createFinishChecker } from '#src/features/schematic/puzzle/solver-client.ts'
import { puzzleFixture } from '../../fixtures/systems-fixtures.ts'

const base: PuzzleDef = {
  scene: 'hall',
  facts: { power: false },
  items: ['crank'],
  hotspots: { shutter: { x: 0, z: 0 } },
  entry: [{ name: 'start', items: ['crank'] }],
  actions: [
    { id: 'crank-it', at: 'shutter', use: 'crank', then: [{ set: 'power', to: true }], say: 'It whirs.' },
  ],
  systemic: [],
  lethal: [],
  goal: [{ fact: 'power', is: true }],
  fallback: {},
}

describe('can it be finished', () => {
  it('says yes, with how many steps the shortest way takes', () => {
    expect(canFinish(base)).toEqual({ finishable: true, words: 'Yes, in 1 step.' })
  })

  it('says how many steps for a longer way', () => {
    const two: PuzzleDef = {
      ...base,
      facts: { power: false, open: false },
      actions: [
        // The first action that matches wins, so the one that needs the crank comes before the bare-handed one.
        {
          id: 'crank-it',
          at: 'shutter',
          use: 'crank',
          when: [{ fact: 'open', is: true }],
          then: [{ set: 'power', to: true }],
          say: 'It whirs.',
        },
        { id: 'open', at: 'shutter', then: [{ set: 'open', to: true }], say: 'It opens.' },
      ],
    }
    expect(canFinish(two).words).toBe('Yes, in 2 steps.')
  })

  it('says no when nothing reaches the goal', () => {
    const no: PuzzleDef = { ...base, goal: [{ fact: 'power', is: 'never' }] }
    const answer = canFinish(no)
    expect(answer.finishable).toBe(false)
    expect(answer.words).toMatch(/^No: /)
  })

  it('says where the player can get stuck, by what they did', () => {
    const stuck: PuzzleDef = {
      ...base,
      hotspots: { shutter: { x: 0, z: 0 }, bin: { x: 1, z: 1 } },
      actions: [
        ...base.actions,
        { id: 'bin-the-crank', at: 'bin', use: 'crank', then: [{ take: 'crank' }], say: 'Gone.' },
      ],
    }
    expect(canFinish(stuck)).toEqual({
      finishable: true,
      words: 'Yes, in 1 step. But the player can get stuck after bin the crank (crank).',
    })
  })

  it('does not stop at what the game’s code does, and says it was not counted', () => {
    const calls: PuzzleDef = {
      ...base,
      actions: [
        {
          ...(base.actions[0] as PuzzleDef['actions'][number]),
          then: [{ set: 'power', to: true }, { call: 'wake' }],
        },
      ],
    }
    expect(canFinish(calls).words).toBe('Yes, in 1 step. What the game’s code does (wake) is not counted.')
  })

  it('answers for a real scene without throwing', () => {
    const answer = canFinish(puzzleFixture('prologue'))
    expect(typeof answer.words).toBe('string')
    expect(answer.words.length).toBeGreaterThan(5)
  })
})

describe('the worker the page asks', () => {
  it('posts the edited puzzle to the worker and hands back its answer', async () => {
    const posted: unknown[] = []
    let listener: ((event: MessageEvent) => void) | undefined
    const worker = {
      postMessage: (message: { id: number; def: PuzzleDef }) => {
        posted.push(message)
        queueMicrotask(() =>
          listener?.({
            data: { id: message.id, answer: { finishable: true, words: 'Yes, in 1 step.' } },
          } as MessageEvent),
        )
      },
      addEventListener: (_: string, fn: (event: MessageEvent) => void) => {
        listener = fn
      },
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    }
    const checker = createFinishChecker(() => worker as unknown as Worker)
    await expect(checker.ask(base)).resolves.toEqual({ finishable: true, words: 'Yes, in 1 step.' })
    expect(posted).toHaveLength(1)
    expect((posted[0] as { def: PuzzleDef }).def).toEqual(base)
    checker.stop()
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('says so, in words, when the worker fails', async () => {
    let listener: ((event: MessageEvent) => void) | undefined
    const worker = {
      postMessage: (message: { id: number }) =>
        queueMicrotask(() => listener?.({ data: { id: message.id, error: 'boom' } } as MessageEvent)),
      addEventListener: (_: string, fn: (event: MessageEvent) => void) => {
        listener = fn
      },
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    }
    const checker = createFinishChecker(() => worker as unknown as Worker)
    await expect(checker.ask(base)).resolves.toEqual({
      finishable: false,
      words: 'The check could not run: boom',
    })
  })

  it('is built for the page without a single Node module in it', async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        write: false,
        minify: false,
        lib: {
          entry: new URL('../../../src/features/schematic/puzzle/solver.worker.ts', import.meta.url).pathname,
          formats: ['es'],
        },
        rollupOptions: { external: [] },
      },
    })
    const outputs = Array.isArray(result)
      ? result.flatMap((r) => ('output' in r ? r.output : []))
      : 'output' in result
        ? result.output
        : []
    const code = outputs.map((o) => ('code' in o ? o.code : '')).join('\n')
    expect(code.length).toBeGreaterThan(1000)
    expect(code).not.toMatch(/from\s*["'](node:|fs|path|child_process|os)/)
  }, 60_000)
})
