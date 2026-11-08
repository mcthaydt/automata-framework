import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { afterAll, describe, expect, it } from 'vitest'
import { browserOnlyFindings } from '#src/features/boundaries/browser-only.ts'
import { createGame } from '#src/shared/create-game/create-game.ts'
import { readTemplateContent, TEMPLATE_CONTENT_PATHS } from '#src/shared/create-game/template-content.ts'
import { EMBEDDED_TEMPLATE_CONTENT } from '#src/shared/create-game/template-embedded.ts'
import { templateFiles } from '#src/shared/create-game/template-files.ts'
import { toolsVersion } from '#src/shared/create-game/tools-version.ts'
import { templateFolderFiles } from '../../../../scripts/write-template-embedded.ts'

// The Automata app makes a new game on a phone, where there is no Node: `templateFiles` is the same list of files
// `create-game` writes, as text in memory.

const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

describe('the embedded starter level', () => {
  it('holds every file of template-content/ as it is on disk', () => {
    expect(Object.keys(EMBEDDED_TEMPLATE_CONTENT).sort()).toEqual([...TEMPLATE_CONTENT_PATHS].sort())
    expect(EMBEDDED_TEMPLATE_CONTENT).toEqual(templateFolderFiles())
  })

  it('is what readTemplateContent gives', () => {
    for (const path of TEMPLATE_CONTENT_PATHS)
      expect(readTemplateContent(path)).toBe(EMBEDDED_TEMPLATE_CONTENT[path])
  })
})

describe('templateFiles', () => {
  it('equals, byte for byte, what create-game writes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-template-files-'))
    made.push(dir)
    const game = join(dir, 'game')
    await Effect.runPromise(createGame({ targetDir: game, id: 'phone-game', title: 'Phone Game' }))
    const written = new Map(
      readdirSync(game, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const path = join(entry.parentPath, entry.name)
          return [path.slice(game.length + 1), readFileSync(path, 'utf8')] as const
        }),
    )
    const files = templateFiles({ id: 'phone-game', title: 'Phone Game', frameworkVersion: toolsVersion() })
    expect(new Map(files.map(({ path, text }) => [path, text]))).toEqual(written)
  })

  it('asks for the framework version it is given, and needs one', () => {
    const pkg = (version: string | undefined) =>
      JSON.parse(
        templateFiles({ id: 'g', title: 'G', frameworkVersion: version }).find(
          ({ path }) => path === 'package.json',
        )?.text ?? '{}',
      )
    expect(pkg('1.2.3').dependencies['@mcthaydt/automata']).toBe('^1.2.3')
    expect(() => pkg(undefined)).toThrow(/framework version/)
  })

  it('has no Node built-in and no Effect in everything the template-files entry reaches', () => {
    const { findings } = browserOnlyFindings(join(import.meta.dirname, '../../../..'), ['template-files'])
    expect(findings).toEqual([])
  })
})
