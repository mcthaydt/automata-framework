import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { level2dKinds } from '@mcthaydt/automata-content/level-2d'
import { describe, expect, it } from 'vitest'
import { contentConfig } from '#src/content.config.ts'

describe('content.config.ts', () => {
  // The Automata app reads this one file to compile the game's content on a phone, so the plugin must be given
  // the same object and no second list of kinds may live in vite.config.ts.
  it('names the kinds the content plugin compiles', () => {
    expect(contentConfig.schemas.map(({ kind }) => kind)).toEqual(level2dKinds().map(({ kind }) => kind))
  })

  it('is the only place vite.config.ts takes the kinds from', () => {
    const viteConfig = readFileSync(join(import.meta.dirname, '../../vite.config.ts'), 'utf8')
    expect(viteConfig).toContain("import { contentConfig } from './src/content.config.ts'")
    expect(viteConfig).not.toContain('level2dKinds')
  })
})
