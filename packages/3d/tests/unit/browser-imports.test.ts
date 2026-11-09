// This package runs in the page, so it imports content's browser-safe entries (`/schema`, `/palette`), never the root:
// the root is the compiler, and in Vite's dev server its Node built-ins throw at boot (a blank page). Type-only
// imports from the root are erased and allowed.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = join(dirname(fileURLToPath(import.meta.url)), '../../src')
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'testing' ? [] : sources(path)
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
  })

describe("the package's content imports", () => {
  it('value-imports nothing from the content root', () => {
    // The scan reads the package's own sources: a path that misses them would pass for the wrong reason.
    expect(sources(src).length).toBeGreaterThan(100)
    const offenders = sources(src).filter((file) =>
      /^import\s+(?!type\s)[^'"]*from\s+'@automata\/content'/m.test(readFileSync(file, 'utf8')),
    )
    expect(offenders.map((file) => file.slice(src.length + 1))).toEqual([])
  })
})
