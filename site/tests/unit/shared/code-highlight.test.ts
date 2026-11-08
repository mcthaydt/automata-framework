import { describe, expect, it } from 'vitest'
import { highlightCode } from '#src/shared/utils/highlight.ts'

// The docs' highlighter writes inline colour styles (github-light), not classes, so a reader's keyword is coloured.
describe('the shared code highlighter', () => {
  it('colours a TypeScript keyword', async () => {
    const html = await highlightCode('const a = 1', 'ts')
    const keyword = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('span')].find(
      (span) => span.textContent === 'const',
    )
    expect(keyword?.getAttribute('style')).toMatch(/color:\s*#/i)
  })
})
