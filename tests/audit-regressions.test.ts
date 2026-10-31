import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import TerminalBox from '../src/lib/components/TerminalBox.svelte'
import Header from '../src/lib/components/Header.svelte'
import CommandMenu from '../src/lib/components/CommandMenu.svelte'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'
import Cheatsheet from '../src/routes/cheatsheet/+page.svelte'
import docs from '../src/data/docs.json'
import apiIndex from '../src/data/api-index.json'
import { resolve } from 'node:path'
import { findHardCodedHashes, siteSourceFiles } from './helpers/hard-coded-hashes'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => vi.restoreAllMocks())

describe('Audit regressions', () => {
  it('reports denied clipboard access without claiming success', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const view = render(TerminalBox, { props: { command: 'example command' } })
    await fireEvent.click(view.getByRole('button', { name: /copy command/i }))
    await waitFor(() => expect(view.getByRole('status').textContent).toMatch(/couldn.t copy/i))
    expect(view.queryByText(/^Copied$/)).toBeNull()
  })

  it('exposes mobile navigation and marks the current page', () => {
    const view = render(Header, { props: { pathname: '/examples' } })
    expect(view.getByText('Menu').closest('summary')).toBeTruthy()
    expect(view.getAllByRole('link', { name: 'Examples' }).every(a => a.getAttribute('aria-current') === 'page')).toBe(true)
  })

  it('documents actual async sim creation and does not invent runtime exports', () => {
    const sim = CHEATSHEET_MODULES[0].entries.find(entry => entry.name === 'createSim')!
    expect(sim.returnType).toBe('Promise<Sim>')
    expect(CHEATSHEET_MODULES.flatMap(mod => mod.entries).some(entry => entry.name === 'runApp')).toBe(false)
  })

  it('provides labelled search across documentation and API entries', async () => {
    const view = render(CommandMenu, { props: { isOpen: true } })
    const input = view.getByRole('searchbox', { name: /search/i })
    await fireEvent.input(input, { target: { value: 'createSim' } })
    expect(view.getByRole('link', { name: /createSim/i }).getAttribute('href')).toContain('/cheatsheet#')
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
    expect(findHardCodedHashes(planted)).toEqual(['src/routes/page.svelte: 31f50888ccb4cf0a', 'src/data/claims.ts: 021df7c6554d00c6'])
  })

  it('lets the evidence file and the framework source snapshots carry hashes, and ignores long numbers', () => {
    const allowed = [
      { path: 'src/data/evidence.json', text: '"hash": "31f50888ccb4cf0a"' },
      { path: 'src/data/projects.json', text: "const GOLDEN_HASH = '31f50888ccb4cf0a'" },
      { path: 'src/data/limits.ts', text: 'export const MAX = 9007199254740992' },
    ]
    expect(findHardCodedHashes(allowed)).toEqual([])
  })
})

// Each claim restored from docs/2026-10-14-cut-claims.md is pinned here with its proof link (DX.10a).
describe('Restored claims (DX.10a)', () => {
  it('labels the generated API reference as complete for the packages it was generated from, and links it', () => {
    const view = render(Cheatsheet)
    expect(view.getByRole('link', { name: 'Complete generated reference (plain text)' }).getAttribute('href')).toBe('/llms-api.txt')
    expect(apiIndex.exports).toBeGreaterThan(0)
  })

  it('says what each plain-text file holds and that none of them is the framework source', () => {
    const rules = docs.find(doc => doc.slug === 'ai-rules')!.content
    expect(rules).toContain("llms-full.txt, the framework's defined documentation corpus followed by its complete API reference, and llms-api.txt, that reference alone, both generated from the package declarations by the framework's API index")
    expect(rules).toContain('None of them is the framework source.')
    expect(rules).not.toMatch(/complete plain-text documentation|exhaustive/i)
  })
})
