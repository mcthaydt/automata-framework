// The peek's numbers are content: one file, `content/peek.toml`, with its own schema, so a person changes how long she must
// stand still or how far the camera leans without touching code, and an editor can be built over it. A file that is absent,
// or leaves a number out, gives the old game's value. The kind is sim content: the sim's content hash covers it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContentResult } from '@automata/content'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PEEK, peekContent, peekDefOf, peekFileSchema } from '#src/entries/sim.ts'

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

async function compile(text: string) {
  root = mkdtempSync(join(tmpdir(), 'peek-content-'))
  mkdirSync(join(root, 'content'), { recursive: true })
  writeFileSync(join(root, 'content', 'peek.toml'), text)
  return compileContentResult({ root, schemas: [peekContent] })
}

describe('the peek file', () => {
  it('is the `peek` kind, one file, and sim content', () => {
    expect(peekContent.kind).toBe('peek')
    expect(peekContent.place).toEqual({ file: 'peek.toml' })
    expect(peekContent.sim).toBe(true)
  })

  it('reads any of the numbers, and the rest are the old game’s', () => {
    expect(peekDefOf(peekFileSchema.parse({ dwell: 1.5, lean: 0.8 }))).toEqual({
      ...DEFAULT_PEEK,
      dwell: 1.5,
      lean: 0.8,
    })
    expect(peekDefOf(undefined)).toEqual(DEFAULT_PEEK)
    expect(peekDefOf(peekFileSchema.parse({}))).toEqual(DEFAULT_PEEK)
  })

  it('compiles from content/peek.toml', async () => {
    const result = await compile('reach = 2\narc = 40\n')
    if (!result.ok) throw new Error(result.error.message)
    expect(JSON.stringify(result.content)).toContain('"arc":40')
  })

  it('names the file and line of a number that cannot be one, in words', async () => {
    const result = await compile('dwell = 0.6\narc = 200\n')
    if (result.ok) throw new Error('the compile passed')
    if (result.error._tag !== 'ContentCompileFailed') throw new Error(result.error.message)
    expect(result.error.diagnostics).toEqual([
      expect.objectContaining({
        file: 'content/peek.toml',
        line: 2,
        message: expect.stringContaining('arc must be between 0 and 180 degrees, not 200'),
      }),
    ])
  })

  it('refuses a name it does not know, and a number below zero', () => {
    expect(peekFileSchema.safeParse({ speed: 2 }).success).toBe(false)
    expect(peekFileSchema.safeParse({ lean: -1 }).success).toBe(false)
    expect(peekFileSchema.safeParse({ reach: 0 }).success).toBe(false)
  })
})
