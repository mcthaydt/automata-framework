// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The framework's generated llms-full.txt and llms-api.txt are published unchanged (DX.10a, DX spec §2.3); see
// scripts/sync-api-index.ts. A hand edit, or a sync from another framework commit, turns this red.

const root = resolve(import.meta.dirname, '..')
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8')
const source = JSON.parse(read('src/data/api-index.json')) as { commit: string; version: string; exports: number; files: Record<string, string> }
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

describe('the framework API index, as published', () => {
  it('was taken from the framework commit the site records', () => {
    expect(source.commit).toBe(read('framework.ref').trim())
    expect(source.exports).toBeGreaterThan(0)
  })

  it('serves llms-full.txt and llms-api.txt exactly as the index wrote them', () => {
    for (const name of ['llms-full.txt', 'llms-api.txt']) expect(sha256(read(`static/${name}`)), name).toBe(source.files[name])
    expect(read('static/llms-full.txt').endsWith(read('static/llms-api.txt'))).toBe(true)
    expect(read('static/llms-full.txt')).toMatch(new RegExp(`^# Automata Framework ${source.version.replaceAll('.', '\\.')}: full documentation`))
  })

  it('lists the three plain-text files in llms.txt with what each one holds', () => {
    const index = read('static/llms.txt')
    expect(index).toContain(`- [Full documentation](/llms-full.txt): The framework's defined documentation corpus and its complete API reference for version ${source.version}, generated from the package declarations.`)
    expect(index).toContain(`- [API reference](/llms-api.txt): Every export of the ${source.version} packages with its signature and doc comment, generated from the package declarations.`)
    expect(index).toContain('- [Site guides](/llms-guides.txt): The guides, task prompts and selected API examples on this site.')
  })
})
