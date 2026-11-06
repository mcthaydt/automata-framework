// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { STANDALONE_NAMES } from '../scripts/site-checks'
import { readApiIndex } from '../src/shared/framework/api.ts'
import { playgroundExamples } from '../src/shared/framework/examples.ts'
import { projectSources } from '../src/shared/framework/sources.ts'

// STANDALONE.1: the site's check leaves text it shows verbatim from the framework to the framework
// (`data-framework-copy` on the source viewer and the playground's code; llms-full.txt and llms-api.txt). Those files
// may still name the reference projects until the framework rewords them. Then this fails: remove the exemption (the
// markers and SITE_TEXT_FILES' omission) in the same pull request.
describe('the framework-copy exemption', () => {
  it('is still needed: a framework file the site shows still names a reference project', () => {
    const { llmsFull, llmsApi } = readApiIndex()
    const shown = {
      'the source explorer': JSON.stringify(projectSources()),
      'the examples': JSON.stringify(playgroundExamples()),
      'llms-full.txt': llmsFull,
      'llms-api.txt': llmsApi,
    }
    const naming = Object.entries(shown).filter(([, text]) =>
      STANDALONE_NAMES.some((name) => name.pattern.test(text)),
    )
    expect(
      naming,
      'no framework file names a reference project any more: remove the data-framework-copy exemption',
    ).not.toEqual([])
  })
})
