import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getDocSections } from '../src/features/docs/docs-loader'
import Examples from '../src/features/examples/ExamplesIndex.svelte'
import CommandMenu from '../src/features/search/CommandMenu.svelte'
import Home from '../src/routes/+page.svelte'
import Header from '../src/shared/components/Header.svelte'
import TerminalBox from '../src/shared/components/TerminalBox.svelte'

const docs = getDocSections()

import { resolve } from 'node:path'
import { findHardCodedHashes, siteSourceFiles } from './helpers/hard-coded-hashes'

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
    const view = render(TerminalBox, { props: { command: 'example command' } })
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
    const guides = [{ title: 'Quick Start', detail: 'Make a game', url: '/docs/quick-start' }]
    const view = render(CommandMenu, { props: { isOpen: true, guides } })
    const input = view.getByRole('searchbox', { name: /search/i })
    await fireEvent.input(input, { target: { value: 'quick start' } })
    expect(view.getByRole('link', { name: /Quick Start/i }).getAttribute('href')).toBe('/docs/quick-start')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement?.tagName).toBe('A')
  })
})

describe('Evidence, not typed numbers (DX.9w)', () => {
  it('hard-codes no simulation hash anywhere in the site’s sources', () => {
    expect(findHardCodedHashes(siteSourceFiles(resolve(import.meta.dirname, '..')))).toEqual([])
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

// Each claim restored from docs/2026-10-14-cut-claims.md is pinned here with its proof link (DX.10a).
describe('Restored claims (DX.10a)', () => {
  it('makes no cross-engine claim while the site has no evidence page to link it to', () => {
    // The claim and its /proof page left with the synced evidence file (task 10.2); it returns with its evidence.
    const view = render(Home)
    expect(view.queryByText('Same result in every engine')).toBeNull()
    expect(view.container.querySelector('a[href="/proof"]')).toBeNull()
    expect(view.container.textContent).not.toMatch(/complete determinism|100% match|run identically/i)
  })

  it('states the 780×270 input journeys the framework runs, and keeps them apart from real-device acceptance', () => {
    const doc = docs.find((entry) => entry.slug === 'mobile-ui')!.content
    expect(doc).toContain('## Tested input journeys')
    expect(doc).toContain(
      'At 780×270, the framework’s input matrix plays a touch journey and a gamepad journey in Chromium under a fake host.',
    )
    expect(doc).toContain(
      'Keyboard journeys run at the tablet and desktop sizes, in Chromium, WebKit and Firefox at desktop size.',
    )
    expect(doc).toContain(
      'These are browser tests with simulated input and DOM geometry. Acceptance on real phones and controllers is separate and still open.',
    )
    expect(doc).toContain(
      'https://github.com/mcthaydt/automata-framework/blob/main/packages/tools/src/e2e/input-matrix.ts',
    )
    expect(doc).not.toMatch(/verified at 780|full parity|input parity/i)
  })

  it('describes the playground’s live updates, diagnostics and restart, bounded to the playground', () => {
    const view = render(Examples, { props: { data: { index: [] } } })
    const section = view.getByRole('region', { name: 'How an example runs' })
    expect(section.textContent).toContain(
      'Edit the code and the example runs again once you pause typing. Each run starts in a new preview frame and is shown only once it is running, so an edit that fails leaves the last working preview in place.',
    )
    expect(section.textContent).toContain(
      'A compile error is marked in the editor at its line and column and named under the preview; selecting it moves the cursor there.',
    )
    expect(section.textContent).toContain(
      'Restart runs the last code that compiled again, in a new frame, without reloading the page.',
    )
    expect(section.textContent).toContain(
      'This is how the playground on this site works, not a description of a game’s own hot reload or restart.',
    )
    expect(section.textContent).not.toMatch(/instant|in-place|without losing state/i)
  })

  it('says what each plain-text file holds and that none of them is the framework source', () => {
    const rules = docs.find((doc) => doc.slug === 'ai-rules')!.content
    expect(rules).toContain(
      "llms-full.txt, the framework's defined documentation corpus followed by its complete API reference, and llms-api.txt, that reference alone, both generated from the package declarations by the framework's API index",
    )
    expect(rules).toContain('None of them is the framework source.')
    expect(rules).not.toMatch(/complete plain-text documentation|exhaustive/i)
  })
})
