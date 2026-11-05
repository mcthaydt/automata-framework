import { describe, expect, it } from 'vitest'
import { defineContentGenerator, type GeneratorInput, runGenerators } from './content-generator'

const input: GeneratorInput = {
  data: { song: { dawn: {} } },
  hash: '0123456789abcdef',
  sim: { data: { tuning: {} }, hash: 'fedcba9876543210' },
  schemas: [],
  messages: {},
  tuning: {},
}

describe('runGenerators', () => {
  it('collects every file and diagnostic', () => {
    const a = defineContentGenerator('songs', ({ data }) => ({
      files: { 'songs.txt': Object.keys(data).join() },
    }))
    const b = defineContentGenerator('hash', ({ hash }) => ({
      files: { 'nested/hash.txt': hash },
      diagnostics: [
        { code: 'invalidGame', file: 'content/game.toml', line: 1, column: 1, keyPath: '', message: 'x' },
      ],
    }))
    const result = runGenerators([a, b], input)
    expect([...result.files]).toEqual([
      ['songs.txt', 'song'],
      ['nested/hash.txt', '0123456789abcdef'],
    ])
    expect(result.diagnostics.map((d) => d.message)).toEqual(['x'])
    expect(result.configProblems).toEqual([])
  })

  it("reports a throw as a mistake in the game's code, naming the generator", () => {
    const broken = defineContentGenerator('broken', () => {
      throw new Error('no catalog')
    })
    const result = runGenerators([broken], input)
    expect(result.diagnostics).toEqual([])
    expect(result.configProblems).toEqual(['generator "broken" threw: no catalog'])
  })

  it('refuses two generators on one path, a path outside the output folder, and a repeated name', () => {
    const one = defineContentGenerator('one', () => ({ files: { 'x.json': '1' } }))
    const two = defineContentGenerator('two', () => ({
      files: { 'x.json': '2', '../escape.txt': '', '/abs.txt': '' },
    }))
    expect(runGenerators([one, two, one], input).configProblems).toEqual([
      'generators "one" and "two" both write x.json',
      'generator "two" writes ../escape.txt, outside the output folder',
      'generator "two" writes /abs.txt, outside the output folder',
      'generator "one" is registered twice',
    ])
  })
})
