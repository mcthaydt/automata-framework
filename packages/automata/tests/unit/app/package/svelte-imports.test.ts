import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// `svelte-package` turns an extensionless import of a `.svelte.ts` module into the `.svelte.js` it emits, but it leaves a
// written-out `.svelte.ts` as it is, and a packed game's build then cannot find the file (the consumer smoke's
// `UNRESOLVED_IMPORT`). A type import is erased, so only a value import has to be extensionless.

const SRC = join(import.meta.dirname, '../../../../src')

function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? svelteFiles(join(dir, entry.name))
      : entry.name.endsWith('.svelte')
        ? [join(dir, entry.name)]
        : [],
  )
}

describe('a component imports a .svelte.ts module', () => {
  it('without the extension, so the packed build finds the .js it becomes', () => {
    const written: string[] = []
    for (const file of svelteFiles(SRC)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (/^\s*import\s+(?!type\b)[^'"]*from\s+['"][^'"]*\.svelte\.ts['"]/.test(line)) {
          written.push(`${file.slice(SRC.length + 1)}: ${line.trim()}`)
        }
      }
    }
    expect(written).toEqual([])
  })
})
