import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cheatsheet } from './cheatsheet.ts'
import { entryPoints } from './entry-points.ts'
import { extractExports } from './extract.ts'

const repo = fileURLToPath(new URL('../fixtures/repo', import.meta.url))
const exports = extractExports(entryPoints(repo))
const page = cheatsheet(exports)
const lines = page.split('\n')

describe('the cheatsheet', () => {
  it('names no version, so a version bump alone does not make the committed page stale', () => {
    expect(lines[0]).toBe('# Automata cheatsheet')
    expect(page).not.toContain('1.2.3')
  })

  it('has one section per package (module) and one per entry point, in index order', () => {
    const headings = lines.filter((line) => line.startsWith('#'))
    expect(headings).toEqual([
      '# Automata cheatsheet',
      '## `@fixture/alpha`',
      "### `import { … } from '@fixture/alpha'`",
      "### `import { … } from '@fixture/alpha/sub'`",
    ])
  })

  it('shows a function by its call form, overloads with the same parameters once', () => {
    const adds = lines.filter((line) => line.startsWith('- `add('))
    expect(adds).toEqual(['- `add(a, b)`: Adds two numbers.'])
  })

  it('names an export renamed through a chunk by its public name', () => {
    expect(lines).toContain('- `area(size)`')
  })

  it('shows any other export with its kind and the first sentence of its doc', () => {
    expect(lines).toContain('- `Named` (interface): A thing with a name.')
    expect(lines).toContain('- `DEFAULT_SIZE` (const): The default size.')
    expect(lines).toContain('- `Color` (enum): Colors.')
    expect(lines).toContain(
      '- `ShapeKind` (type): A shape kind, renamed through this chunk the way rolldown-plugin-dts does.',
    )
  })

  it('marks a deprecated export', () => {
    expect(lines).toContain('- `Counter` (class): A counter. (deprecated)')
  })

  it('gives an undocumented export no summary', () => {
    expect(lines).toContain('- `undocumented` (const)')
  })

  it('lists every export of the index exactly once', () => {
    expect(lines.filter((line) => line.startsWith('- `'))).toHaveLength(exports.length)
    expect(lines).toContain('- `subOnly()`: Only in the sub entry point.')
  })
})
