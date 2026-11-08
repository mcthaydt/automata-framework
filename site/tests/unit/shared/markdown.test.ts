import { describe, expect, it } from 'vitest'
import { headingId, parseMarkdown } from '#src/shared/utils/markdown'

// The guides are written for GitHub's renderer, wrapped at 120 columns: the docs pages must read them the same way.
describe('parseMarkdown', () => {
  it('keeps a list item that wraps onto the next line in one item', () => {
    const blocks = parseMarkdown(
      '- **Level**: paint walls. The tools are at the\n  top of the level.\n- **Map**: where each level sits.',
    )
    expect(blocks).toEqual([
      {
        type: 'ul',
        items: [
          { text: '**Level**: paint walls. The tools are at the top of the level.' },
          { text: '**Map**: where each level sits.' },
        ],
      },
    ])
  })

  it('keeps a numbered list whole across a code block inside one of its items', () => {
    const blocks = parseMarkdown(
      [
        '1. Create the page.',
        '2. Set the names. It writes a placeholder',
        '   that you replace:',
        '',
        '   ```ts',
        "   itch: { project: 'me/game' },",
        '   ```',
        '',
        '3. Install butler.',
        '',
        'After the list.',
      ].join('\n'),
    )
    expect(blocks).toEqual([
      {
        type: 'ol',
        items: [
          { text: 'Create the page.' },
          {
            text: 'Set the names. It writes a placeholder that you replace:',
            code: { lang: 'ts', code: "itch: { project: 'me/game' }," },
          },
          { text: 'Install butler.' },
        ],
      },
      { type: 'p', content: 'After the list.' },
    ])
  })

  it('reads headings, code, tables and callouts', () => {
    const blocks = parseMarkdown(
      '## The four packages\n\n| A | B |\n|---|---|\n| `x` | y |\n\n```sh\npnpm dev\n```\n\n> [!NOTE]\n> Plain words.\n\n### A step',
    )
    expect(blocks).toEqual([
      { type: 'h2', content: 'The four packages', headingId: 'the-four-packages' },
      { type: 'table', tableHeaders: ['A', 'B'], tableRows: [['`x`', 'y']] },
      { type: 'code', lang: 'sh', code: 'pnpm dev' },
      { type: 'callout', calloutType: 'note', content: 'Plain words.' },
      { type: 'h3', content: 'A step', headingId: 'a-step' },
    ])
  })

  it('gives a heading the id its "On this page" link points at', () => {
    expect(headingId('Safe on any web `host`!')).toBe('safe-on-any-web-host')
  })
})
