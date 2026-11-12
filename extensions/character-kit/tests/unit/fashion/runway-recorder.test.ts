import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repointShowcase, SHOWCASE_IMPORTS } from '../../../scripts/showcase-imports.ts'

// `goldens:runway` runs the showcase's three files (read from the archived FigureBuilder) on the painter in this repository, by
// rewriting the paths they import the painter's `src` by. The painter's files moved since those paths were written, so the
// recorder cannot be run here without the archived clone: these cases prove the rewrite instead, over the lines the showcase has,
// and that every file it names exists today.
const PAINTER = join(import.meta.dirname, '../../../../figures')

describe('the runway recorder points the showcase at the painter', () => {
  it('rewrites the showcase imports to the painter files that exist today', () => {
    const showcase = [
      "import { Figure } from '../../src'",
      "import { PARTS } from '../../src/features/body/parts'",
      "import { clamp } from '../../src/lib/math'",
      "import { CAST } from './characters'",
    ].join('\n')
    const out = repointShowcase(showcase, PAINTER)
    expect(out).toContain(`from '${join(PAINTER, 'src/entries/index.ts')}'`)
    expect(out).toContain(`from '${join(PAINTER, 'src/shared/body/parts.ts')}'`)
    expect(out).toContain(`from '${join(PAINTER, 'src/shared/math/math.ts')}'`)
    // A sibling of the showcase is not the painter's: left as it is.
    expect(out).toContain("from './characters'")
  })

  it('names only files that exist', () => {
    for (const to of Object.values(SHOWCASE_IMPORTS)) expect(existsSync(join(PAINTER, to)), to).toBe(true)
  })

  it('refuses an import of the painter it has no file for, naming it', () => {
    expect(() => repointShowcase("import x from '../../src/lib/gone'", PAINTER)).toThrow('../../src/lib/gone')
  })
})
