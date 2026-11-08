import { describe, expect, it } from 'vitest'
import { highlightCode } from '#src/shared/utils/highlight.ts'

// The docs' highlighter writes inline colour styles (github-dark, for the dark site), not classes, so a reader's keyword is coloured.
describe('the shared code highlighter', () => {
  it('colours a TypeScript keyword', async () => {
    const html = await highlightCode('const a = 1', 'ts')
    const keyword = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('span')].find(
      (span) => span.textContent === 'const',
    )
    expect(keyword?.getAttribute('style')).toMatch(/color:\s*#/i)
    // github-dark's keyword pink; the light theme's keyword is #D73A49, which a dark box cannot read.
    expect(keyword?.getAttribute('style')).toMatch(/#F97583/i)
  })
})
