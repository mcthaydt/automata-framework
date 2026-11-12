// The carried light's numbers are content: one file, `content/carried-light.toml`, with its own schema, so a person changes the
// radius, the fuel it starts with, a refill, what it holds and how fast it burns without touching code, and an editor can be built
// over it. A file that is absent, or leaves a number out, gives the old game's value. The kind is sim content: the sim's
// content hash covers it, since it decides how long a light lasts.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContentResult } from '@automataframework/content'
import { afterEach, describe, expect, it } from 'vitest'
import {
  carriedLightContent,
  carriedLightDefOf,
  carriedLightFileSchema,
  DEFAULT_CARRIED_LIGHT,
} from '#src/entries/sim.ts'

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

async function compile(text: string) {
  root = mkdtempSync(join(tmpdir(), 'carried-light-content-'))
  mkdirSync(join(root, 'content'), { recursive: true })
  writeFileSync(join(root, 'content', 'carried-light.toml'), text)
  return compileContentResult({ root, schemas: [carriedLightContent] })
}

describe('the carried-light file', () => {
  it('is the `carried-light` kind, one file, and sim content', () => {
    expect(carriedLightContent.kind).toBe('carried-light')
    expect(carriedLightContent.place).toEqual({ file: 'carried-light.toml' })
    expect(carriedLightContent.sim).toBe(true)
  })

  it('reads any of the numbers, and the rest are the old game’s', () => {
    expect(carriedLightDefOf(carriedLightFileSchema.parse({ radius: 3, fill: 20 }))).toEqual({
      ...DEFAULT_CARRIED_LIGHT,
      radius: 3,
      fill: 20,
    })
    expect(carriedLightDefOf(carriedLightFileSchema.parse({}))).toEqual(DEFAULT_CARRIED_LIGHT)
  })

  it('compiles from content/carried-light.toml', async () => {
    const result = await compile('radius = 2.8\nburn = 2\n')
    if (!result.ok) throw new Error(result.error.message)
    expect(JSON.stringify(result.content)).toContain('"burn":2')
  })

  it('names the file and line of a number that cannot be one, in words', async () => {
    const result = await compile('radius = 2.2\nburn = 0.5\n')
    if (result.ok) throw new Error('the compile passed')
    if (result.error._tag !== 'ContentCompileFailed') throw new Error(result.error.message)
    expect(result.error.diagnostics).toEqual([
      expect.objectContaining({
        file: 'content/carried-light.toml',
        line: 2,
        message: expect.stringContaining('burn must be a whole number of 1 or more, not 0.5'),
      }),
    ])
  })

  it('refuses a refill larger than the most it holds, naming both, whichever of them the file gives', () => {
    const both = carriedLightFileSchema.safeParse({ fill: 100, cap: 50 })
    expect(both.error?.issues.map((issue) => issue.message)).toEqual([
      'fill (100 s) is more than cap (50 s): a refill would never fit',
    ])
    // Only fill: the cap is the old game's 80.
    expect(carriedLightFileSchema.safeParse({ fill: 100 }).success).toBe(false)
    expect(carriedLightFileSchema.safeParse({ start: 90 }).success).toBe(false)
  })

  it('refuses a name it does not know, a radius of nothing and a number below zero', () => {
    expect(carriedLightFileSchema.safeParse({ colour: 'red' }).success).toBe(false)
    expect(carriedLightFileSchema.safeParse({ radius: 0 }).success).toBe(false)
    expect(carriedLightFileSchema.safeParse({ fill: -1 }).success).toBe(false)
    expect(carriedLightFileSchema.safeParse({ start: -1 }).success).toBe(false)
  })
})
