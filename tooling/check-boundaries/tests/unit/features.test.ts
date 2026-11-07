import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { featureFindings } from '#src/features.ts'

// Core and 2D refactor spec §3.3 (rules 1 to 5) and §3.5 (the messages): a package's src/ is app/, features/<x>/,
// shared/, entries/ and testing/, and the imports between them go one way.

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A package folder holding the given files under `src/`, and its path. */
function pkg(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'af-features-'))
  roots.push(root)
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, 'src', name)), { recursive: true })
    writeFileSync(join(root, 'src', name), code)
  }
  return root
}

describe('featureFindings', () => {
  it('fails a feature that imports another feature, with the spec message', () => {
    const root = pkg({
      'features/saves/save-slots.ts':
        "import { volume } from '../settings/settings.manager.ts'\nexport const a = volume\n",
      'features/settings/settings.manager.ts': 'export const volume = 1\n',
    })
    const { findings, files } = featureFindings(root)
    expect(files).toHaveLength(2)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      file: join(root, 'src/features/saves/save-slots.ts'),
      line: 1,
      col: 1,
      rule: 'feature-import',
      message:
        '"saves" imports "settings" (features/settings/settings.manager.ts).\n' +
        'A feature may only use its own files and shared/. Pass what it needs in from app/, or move the shared part to shared/.',
    })
  })

  it('lets a feature import its own files and shared/', () => {
    const root = pkg({
      'features/saves/save-slots.ts':
        "import { slot } from './slot.ts'\nimport { clock } from '../../shared/lib/clock.ts'\nexport const a = [slot, clock]\n",
      'features/saves/slot.ts': 'export const slot = 1\n',
      'shared/lib/clock.ts': 'export const clock = 2\n',
    })
    expect(featureFindings(root).findings).toEqual([])
  })

  it('fails shared/ importing a feature', () => {
    const root = pkg({
      'shared/lib/clock.ts':
        "import { slot } from '../../features/saves/slot.ts'\nexport const clock = slot\n",
      'features/saves/slot.ts': 'export const slot = 1\n',
    })
    expect(featureFindings(root).findings).toMatchObject([
      {
        rule: 'shared-import',
        message:
          '"shared" imports "saves" (features/saves/slot.ts).\n' +
          'shared/ may only use shared/ and other packages. Move what it needs into shared/, or move this file into the feature that owns it.',
      },
    ])
  })

  it('fails a feature importing app/', () => {
    const root = pkg({
      'features/saves/save-slots.ts': "import { game } from '../../app/game.ts'\nexport const a = game\n",
      'app/game.ts': 'export const game = 1\n',
    })
    expect(featureFindings(root).findings).toMatchObject([
      {
        rule: 'app-import',
        message:
          '"saves" imports "app" (app/game.ts).\n' +
          'Only entries/ and testing/ may import app/. Pass the value in from app/ instead.',
      },
    ])
  })

  it('lets app/ import features and shared/, and entries/ and testing/ import app/', () => {
    const root = pkg({
      'app/game.ts':
        "import { slot } from '../features/saves/slot.ts'\nimport { clock } from '../shared/lib/clock.ts'\nexport const game = [slot, clock]\n",
      'features/saves/slot.ts': 'export const slot = 1\n',
      'shared/lib/clock.ts': 'export const clock = 2\n',
      'entries/index.ts': "export { game } from '../app/game.ts'\n",
      'testing/fake.ts': "import { game } from '../app/game.ts'\nexport const fake = game\n",
    })
    expect(featureFindings(root).findings).toEqual([])
  })

  it('fails logic in entries/, and allows re-exports and side-effect imports', () => {
    const root = pkg({
      'entries/index.ts':
        "export { game } from '../app/game.ts'\nexport type { Game } from '../app/game.ts'\nimport '../app/boot.ts'\n",
      'entries/logic.ts': "import { game } from '../app/game.ts'\nexport const twice = () => [game, game]\n",
      'app/game.ts': 'export const game = 1\nexport type Game = number\n',
      'app/boot.ts': 'export {}\n',
    })
    const { findings } = featureFindings(root)
    expect(findings).toMatchObject([
      {
        file: join(root, 'src/entries/logic.ts'),
        line: 2,
        rule: 'entries-logic',
        message:
          'entries/ re-exports and holds no logic (found a declaration).\n' +
          'Move the code into app/, features/ or shared/, and re-export it from here.',
      },
    ])
  })

  it('fails product code importing testing/, and lets entries/ and testing/ do it', () => {
    const root = pkg({
      'features/saves/slot.ts': "import { fake } from '../../testing/fake.ts'\nexport const slot = fake\n",
      'testing/fake.ts': 'export const fake = 1\n',
      'entries/testing.ts': "export { fake } from '../testing/fake.ts'\n",
    })
    expect(featureFindings(root).findings).toMatchObject([
      {
        rule: 'testing-import',
        message:
          '"saves" imports "testing" (testing/fake.ts).\n' +
          'testing/ holds the published test helpers; product code never imports it. Only entries/ re-exports it.',
      },
    ])
  })

  it('fails a #src alias in src/, and reads a package name from outside as fine', () => {
    const root = pkg({
      'features/saves/slot.ts':
        "import { x } from '#src/shared/lib/x.ts'\nimport { z } from 'zod'\nexport const slot = [x, z]\n",
      'shared/lib/x.ts': 'export const x = 1\n',
    })
    expect(featureFindings(root).findings).toMatchObject([
      {
        rule: 'alias-in-src',
        line: 1,
        message:
          '"#src/shared/lib/x.ts" is the alias tests use.\n' +
          'Import by relative path in src/; the #src alias is for tests/ only.',
      },
    ])
  })

  it('counts type-only imports too: a type still ties one feature to another', () => {
    const root = pkg({
      'features/saves/save-slots.ts':
        "import type { Volume } from '../settings/volume.ts'\nexport type A = Volume\n",
      'features/settings/volume.ts': 'export type Volume = number\n',
    })
    expect(featureFindings(root).findings).toMatchObject([{ rule: 'feature-import' }])
  })
})
