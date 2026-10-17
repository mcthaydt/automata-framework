import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { collectStackFacts, renderStackPage } from './stack.ts'
import { STACK } from './stack-cards.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// docs/stack.md is generated (PRODUCT spec §9). This is the check that keeps it in step with the pins, the
// installed licenses and stack-cards.ts: `pnpm check` runs it through test:unit.
it('docs/stack.md matches the pins, the installed packages and stack-cards.ts', () => {
  let page = ''
  try {
    page = readFileSync(join(root, 'docs/stack.md'), 'utf8')
  } catch {
    // a missing page is reported by the comparison below
  }
  const expected = renderStackPage(STACK, collectStackFacts(root, STACK.cards))
  expect(page, 'docs/stack.md is out of date; run `pnpm docs:stack`').toBe(expected)
})
