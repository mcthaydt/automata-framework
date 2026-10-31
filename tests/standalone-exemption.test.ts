// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STANDALONE_NAMES } from '../scripts/site-checks'

// STANDALONE.1: the site's check leaves text it copies verbatim from the framework to the framework
// (`data-framework-copy` on /inside, the source viewer and the playground's code; llms-full.txt and llms-api.txt).
// Those copies still name the reference projects until the framework's STANDALONE.2 rewords them and the site
// re-syncs. Then this fails: remove the exemption (the markers and SITE_TEXT_FILES' omission) with that re-sync.
const FRAMEWORK_COPIES = ['src/data/stack.md', 'src/data/projects.json', 'src/data/examples.json', 'src/data/demos.json', 'static/llms-full.txt', 'static/llms-api.txt']

describe('the framework-copy exemption', () => {
  it('is still needed: a framework copy still names a reference project', () => {
    const naming = FRAMEWORK_COPIES.filter(file => {
      const text = readFileSync(resolve(import.meta.dirname, '..', file), 'utf8')
      return STANDALONE_NAMES.some(name => name.pattern.test(text))
    })
    expect(naming, 'no framework copy names a reference project any more: remove the data-framework-copy exemption').not.toEqual([])
  })
})
