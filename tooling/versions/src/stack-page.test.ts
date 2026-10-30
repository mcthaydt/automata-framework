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

/** An SPDX licence expression (`MIT`, `(MIT OR Apache-2.0)`), not one of the page's "none declared" sentences. */
const SPDX_EXPRESSION = /^\(?[\w.+-]+(?: (?:AND|OR|WITH) [\w.+-]+)*\)?$/

// AF's published packages bundle the vendored Ruken code (D-8), so each tarball must declare its licence (R-16,
// PRODUCT.4r): the page never says "not declared" for code AF ships.
it('shows a declared licence for every vendored Ruken package', () => {
  const vendored = [...collectStackFacts(root, STACK.cards).values()].filter(
    (fact) => fact.source !== undefined,
  )
  expect(vendored.map((fact) => fact.name)).toEqual([
    '@ruken/sdk',
    '@ruken/sdk-host',
    '@ruken/manifest',
    '@ruken/cli',
  ])
  const undeclared = vendored
    .filter((fact) => !SPDX_EXPRESSION.test(fact.license))
    .map((fact) => `${fact.name}: ${fact.license}`)
  expect(undeclared).toEqual([])
})
