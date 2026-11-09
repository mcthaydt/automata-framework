import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The package is imported, not copied: each screen has its own entry, `.` has all four, and nothing says to run a
// command that copies files into a game.

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))
const SCREENS = [
  ['title', 'TitleScreen'],
  ['results', 'ResultsScreen'],
  ['loading', 'LoadingScreen'],
  ['error', 'ErrorScreen'],
] as const

describe('the package entries', () => {
  it.each(SCREENS)('imports %s from @automata/ui-screens/%s', async (entry, name) => {
    const module = (await import(/* @vite-ignore */ `@automata/ui-screens/${entry}`)) as Record<
      string,
      unknown
    >
    expect(module[name]).toBeDefined()
  })

  it('has every screen in the main entry', async () => {
    const module = (await import('@automata/ui-screens')) as Record<string, unknown>
    for (const [, name] of SCREENS) expect(module[name], name).toBeDefined()
  })

  it('exports one path per screen and nothing else', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>
    }
    expect(Object.keys(manifest.exports).sort()).toEqual(
      ['.', ...SCREENS.map(([entry]) => `./${entry}`)].sort(),
    )
  })
})

describe('no copy step', () => {
  it('has no copy manifest', () => {
    expect(existsSync(join(ROOT, 'kit.json'))).toBe(false)
  })

  it('does not tell a game to run `automata add`', () => {
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).not.toContain('automata add')
  })
})
