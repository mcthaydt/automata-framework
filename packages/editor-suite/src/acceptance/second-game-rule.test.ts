import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The second-game rule (editor suite spec §8, EDS-D11, EDS-y): no editor's code names a game. The suite's sources and the
// level editors' suite mounts are read with their comments taken out (a comment may credit where an algorithm came from;
// the rule is about behaviour, which a name in code would tie to one game). Tests, test support and the dev sample
// (`main.ts`, which serves a sample game) are not editors.

const PACKAGES = join(import.meta.dirname, '../../..')
const GAMES = /emberwick|base-?3d|floor-?fifty|last-?light|mossgate|hollowmere|ruken/i

function sources(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === 'testing' || name === 'fixtures' || name === 'acceptance' || name === 'node_modules')
        continue
      found.push(...sources(path))
    } else if (/\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name) && name !== 'main.ts')
      found.push(path)
  }
  return found
}

const withoutComments = (text: string): string =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1')

const ROOTS = [
  join(PACKAGES, 'editor-suite/src'),
  join(PACKAGES, 'editor-2d/src/suite'),
  join(PACKAGES, 'editor-3d/src/ui/suite'),
]

describe('EDS-y: no editor names a game', () => {
  const files = [...ROOTS.flatMap(sources), join(PACKAGES, 'editor-3d/src/app/levels-3d-session.ts')]

  it('reads the suite and the level editors’ suite mounts', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it.each(files.map((file) => [file.slice(PACKAGES.length + 1), file] as const))('%s', (_name, file) => {
    const code = withoutComments(readFileSync(file, 'utf8'))
    expect(code.match(GAMES)?.[0]).toBeUndefined()
  })
})
