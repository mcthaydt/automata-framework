// The `./timeline` entry: the keyed tracks, eases and sampler that scripted scenes (the cutscenes extension) and the
// renderer share, importable by a sim because it reaches nothing but `shared/timeline` and Zod.
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as entry from '#src/entries/timeline.ts'
import * as timeline from '#src/shared/timeline/ease.ts'

const sourceRoot = resolve(import.meta.dirname, '../../../src')

/** Every file reachable from `file` through relative imports, and every bare import on the way. */
function importGraph(file: string, files = new Set<string>(), bare = new Set<string>()) {
  if (files.has(file)) return { files, bare }
  files.add(file)
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
    if (spec === undefined) continue
    if (spec.startsWith('.')) importGraph(resolve(dirname(file), spec.replace(/\.js$/, '.ts')), files, bare)
    else bare.add(spec)
  }
  return { files, bare }
}

describe('./timeline', () => {
  it('exports the track, the sampler, the bracket under it, the eases and the ease schema', () => {
    expect(typeof entry.track).toBe('function')
    expect(typeof entry.sample).toBe('function')
    expect(typeof entry.parseEase).toBe('function')
    expect(typeof entry.bracket).toBe('function')
    expect(typeof entry.mixNumber).toBe('function')
    expect(typeof entry.easeSchema.safeParse).toBe('function')
  })

  it('is the shared timeline, not a copy of it', () => {
    expect(entry.easeSchema).toBe(timeline.easeSchema)
    expect(entry.parseEase).toBe(timeline.parseEase)
  })

  it('samples a track between its keys with the key ease, and holds the end values outside them', () => {
    const keys = entry.track<number>([
      [0, 0],
      [1, 10, 'linear'],
    ])
    const mix = (a: number, b: number, u: number): number => a + (b - a) * u
    expect(entry.sample(keys, 0.5, mix)).toBeCloseTo(5, 9)
    expect(entry.sample(keys, -1, mix)).toBe(0)
    expect(entry.sample(keys, 9, mix)).toBe(10)
  })

  it('reaches only shared/timeline and Zod, so a sim file may import it', () => {
    const { files, bare } = importGraph(resolve(sourceRoot, 'entries/timeline.ts'))
    const outside = [...files]
      .map((file) => relative(sourceRoot, file))
      .filter((file) => file !== 'entries/timeline.ts' && !file.startsWith('shared/timeline/'))
    expect(outside).toEqual([])
    expect([...bare]).toEqual(['zod'])
  })
})
