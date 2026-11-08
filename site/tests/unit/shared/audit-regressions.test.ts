import { resolve } from 'node:path'
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import CommandMenu from '../../../src/features/search/CommandMenu.svelte'
import CodeBlock from '../../../src/shared/components/CodeBlock.svelte'
import Header from '../../../src/shared/components/Header.svelte'
import { findHardCodedHashes, siteSourceFiles } from '../../helpers/hard-coded-hashes'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => vi.restoreAllMocks())

describe('Audit regressions', () => {
  it('reports denied clipboard access without claiming success', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const view = render(CodeBlock, { props: { code: 'example command', variant: 'command' } })
    await fireEvent.click(view.getByRole('button', { name: /copy command/i }))
    await waitFor(() => expect(view.getByRole('status').textContent).toMatch(/couldn.t copy/i))
    expect(view.queryByText(/^Copied$/)).toBeNull()
  })

  it('exposes mobile navigation and marks the current page', () => {
    const view = render(Header, { props: { pathname: '/examples' } })
    expect(view.getByLabelText('Menu').tagName).toBe('SUMMARY')
    expect(
      view.getAllByRole('link', { name: 'Examples' }).every((a) => a.getAttribute('aria-current') === 'page'),
    ).toBe(true)
  })

  it('provides labelled search across documentation and API entries', async () => {
    const guides = [{ title: 'How it works', detail: 'The rules run in ticks', url: '/docs/how-it-works' }]
    const view = render(CommandMenu, { props: { isOpen: true, guides } })
    const input = view.getByRole('searchbox', { name: /search/i })
    await fireEvent.input(input, { target: { value: 'how it works' } })
    expect(view.getByRole('link', { name: /How it works/i }).getAttribute('href')).toBe('/docs/how-it-works')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement?.tagName).toBe('A')
  })
})

describe('Evidence, not typed numbers (DX.9w)', () => {
  it('hard-codes no simulation hash anywhere in the site’s sources', () => {
    expect(findHardCodedHashes(siteSourceFiles(resolve(import.meta.dirname, '../../..')))).toEqual([])
  })

  it('catches a hash typed into a page, a data file or a component', () => {
    const planted = [
      { path: 'src/routes/page.svelte', text: '<p>Hash: 31f50888ccb4cf0a</p>' },
      { path: 'src/data/claims.ts', text: "export const GOLDEN = '021df7c6554d00c6'" },
    ]
    expect(findHardCodedHashes(planted)).toEqual([
      'src/routes/page.svelte: 31f50888ccb4cf0a',
      'src/data/claims.ts: 021df7c6554d00c6',
    ])
  })

  it('ignores long numbers', () => {
    expect(
      findHardCodedHashes([{ path: 'src/data/limits.ts', text: 'export const MAX = 9007199254740992' }]),
    ).toEqual([])
  })
})
