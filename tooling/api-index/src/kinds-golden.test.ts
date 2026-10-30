// The index pinned over a fixture with every declaration kind both API tools read (PRODUCT.1b3), so a change to
// the extractor cannot change `api.json` unnoticed. fixtures/kinds/packages/kinds/types is what tsdown 0.23.0
// emits (the published build's options) for tooling/api-report/fixtures/kinds' `.` and `./extra`, whose report
// tooling/api-report/src/kinds-golden.test.ts pins.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { entryPoints } from './entry-points.ts'
import { apiJson } from './render.ts'
import { indexRows } from './rows.ts'

const KINDS_ROOT = fileURLToPath(new URL('../fixtures/kinds', import.meta.url))
const PINNED = fileURLToPath(new URL('../fixtures/kinds/api.json', import.meta.url))

describe('the API index over every declaration kind', () => {
  it('writes the pinned api.json, byte for byte', () => {
    expect(apiJson(indexRows(entryPoints(KINDS_ROOT)))).toBe(readFileSync(PINNED, 'utf8'))
  })
})
