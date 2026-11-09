// A wardrobe garment's numbers and lists are bounded (M3.5b review): each value below would build badly (zero-width
// cargos run out of memory, an empty zip throws, the rest degrade), so the figure file is refused at the field.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileFixture, FIXTURE_ROOT } from '@automata/3d/testing'
import { describe, expect, it } from 'vitest'
import '../../wardrobe.extension.ts'

const file = 'content/figures/keeper.toml'
const top = 'top = "starch"\nsleeves = "short"'
const text = readFileSync(join(FIXTURE_ROOT, file), 'utf8')

/** The 1-based line of the first `needle` in `source`. */
const lineOf = (source: string, needle: string): number =>
  source.slice(0, source.indexOf(needle)).split('\n').length

const cases: { garment: string; field: string }[] = [
  { garment: 'cargos = "charcoal"\nwidth = 0', field: 'width' },
  { garment: 'cargos = "charcoal"\nwidth = -0.2', field: 'width' },
  { garment: 'jacket = "navy"\nzip = []', field: 'zip' },
  { garment: 'bomber = "navy"\nzip = []', field: 'zip' },
  { garment: 'tee = "navy"\nfit = 0', field: 'fit' },
  { garment: 'hoops = "brass"\nsize = -1', field: 'size' },
  { garment: 'puffer = "navy"\nbaffles = 0', field: 'baffles' },
  { garment: 'puffer = "navy"\nbaffles = 2.5', field: 'baffles' },
  { garment: 'chain = "brass"\ndrop = 3', field: 'drop' },
]
describe("a wardrobe garment's numbers and lists are bounded", () => {
  for (const c of cases)
    it(`refuses ${c.garment.replace('\n', ', ')} at the field`, async () => {
      expect(text).toContain(top)
      const changed = text.replace(top, c.garment)
      const result = await compileFixture({ [file]: changed })
      expect(result.ok).toBe(false)
      expect(result.ok ? [] : result.diagnostics).toContainEqual(
        expect.objectContaining({
          file,
          line: lineOf(changed, c.garment.split('\n')[1] ?? ''),
          keyPath: `outfits.shirtsleeves.0.${c.field}`,
        }),
      )
    })
})
