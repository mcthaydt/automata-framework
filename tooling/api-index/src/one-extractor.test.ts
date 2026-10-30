// PRODUCT.1b3: the API index has no extractor of its own. It reads every export through
// tooling/api-report/src/extract.ts, the extractor `pnpm api-report` uses, so the two tools cannot describe one
// declaration two ways. tooling/api-index/src/kinds-golden.test.ts pins what the index writes through it.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('.', import.meta.url))
const sources = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
)

describe('the API index', () => {
  it('creates no TypeScript program of its own', () => {
    const programs = sources.filter((file) => /\bcreateProgram\(/.test(readFileSync(join(SRC, file), 'utf8')))
    expect(programs).toEqual([])
  })
})
