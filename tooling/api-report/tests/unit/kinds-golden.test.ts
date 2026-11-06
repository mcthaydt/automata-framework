// The report pinned over a fixture with every declaration kind both API tools read (PRODUCT.1b3), so a change
// to the extractor cannot change a report unnoticed. tooling/api-index/src/kinds-golden.test.ts pins the index
// over the same API as tsdown emits it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { corePackages } from '#src/core-packages.ts'
import { extractApi } from '#src/extract.ts'
import { renderReport } from '#src/report.ts'

const KINDS_ROOT = fileURLToPath(new URL('../../fixtures/kinds', import.meta.url))
const PINNED = fileURLToPath(new URL('../../fixtures/kinds/reports/kinds.api.md', import.meta.url))

describe('the API report over every declaration kind', () => {
  it('equals the pinned report, byte for byte', () => {
    const [kinds] = extractApi(corePackages(KINDS_ROOT, {}))
    expect(kinds === undefined ? undefined : renderReport(kinds)).toBe(readFileSync(PINNED, 'utf8'))
  })
})
