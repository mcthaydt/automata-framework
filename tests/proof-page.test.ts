import { render, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ProofReport from '../src/lib/components/ProofReport.svelte'
import Footer from '../src/lib/components/Footer.svelte'
import { parseEvidence } from '../src/lib/evidence'
import sample from './fixtures/evidence.sample.json'
import schema from './fixtures/evidence.schema.sample.json'

// DX.9w. The proof page shows what the evidence file says, and only that. These render it from the SAMPLE evidence
// (tests/fixtures), whose hashes are all letters, so a hash on screen can only have come from the file.

const evidence = parseEvidence(sample, schema)
const view = () => render(ProofReport, { props: { evidence } })

describe('the proof report', () => {
  it('shows every engine’s hash for every golden, and nothing else that looks like one', () => {
    const { container } = view()
    const shown = [...container.querySelectorAll('code.hash')].map(node => node.textContent)
    const recorded = evidence.goldens.flatMap(golden => golden.hashes.map(entry => entry.hash))
    expect(shown).toEqual(recorded)
    // Any other 16-hex token in the text of any element would be a hash typed by hand.
    const leaves = [...container.querySelectorAll('*')].filter(node => node.children.length === 0).map(node => node.textContent ?? '')
    expect(leaves.flatMap(text => text.match(/\b[0-9a-f]{16}\b/g) ?? [])).toEqual(recorded)
  })

  it('names the engines with their versions, in the schema’s order', () => {
    const view_ = view()
    const first = view_.getByRole('region', { name: 'sample/agreeing' })
    const rows = within(first).getAllByRole('row').slice(1).map(row => row.textContent)
    expect(rows).toEqual(['Nodev24.0.0aaaaaaaaaaaaaaaa', 'Chromium150.0.0.0aaaaaaaaaaaaaaaa', 'Firefox150.0aaaaaaaaaaaaaaaa', 'WebKit26.0aaaaaaaaaaaaaaaa'])
  })

  it('says plainly when engines agree and when they do not', () => {
    const view_ = view()
    expect(within(view_.getByRole('region', { name: 'sample/agreeing' })).getByText(/All four engines agree/)).toBeTruthy()
    expect(within(view_.getByRole('region', { name: 'sample/disagreeing' })).getByText(/The engines disagree/)).toBeTruthy()
  })

  it('states the seed, the ticks and the test files behind each golden', () => {
    const region = view().getByRole('region', { name: 'sample/agreeing' })
    expect(region.textContent).toContain('Seed 7')
    expect(region.textContent).toContain('300 ticks')
    expect(region.textContent).toContain('packages/sample/src/agreeing.parity.test.ts')
  })

  it('links the CI run and names the revision it ran at', () => {
    const view_ = view()
    const link = view_.getByRole('link', { name: /CI run 1/ })
    expect(link.getAttribute('href')).toBe('https://github.com/example/framework/actions/runs/1')
    expect(view_.container.textContent).toContain('0000000')
    expect(view_.container.textContent).toContain('Playwright 1.63.0')
  })

  it('lists package versions and whether each was released', () => {
    const view_ = view()
    const table = view_.getByRole('table', { name: 'Published packages' })
    expect(within(table).getByText('@sample/released').closest('tr')!.textContent).toContain('1.2.3')
    expect(within(table).getByText('@sample/released').closest('tr')!.textContent).toContain('released')
    expect(within(table).getByText('@sample/unreleased').closest('tr')!.textContent).toContain('not released')
  })

  it('does not claim the automata check passed while the file says it is pending', () => {
    const view_ = view()
    expect(view_.getByText(/Not proved yet/)).toBeTruthy()
    expect(view_.container.textContent).toContain('DX.5')
    expect(view_.container.textContent).not.toMatch(/\bpassed\b/i)
  })
})

describe('the footer', () => {
  it('links the proof page', () => {
    const footer = render(Footer)
    expect(footer.getByRole('link', { name: 'Proof' }).getAttribute('href')).toBe('/proof')
  })
})

describe('the /proof route', () => {
  it('renders from the synced evidence file, or says plainly that it has none and claims nothing', async () => {
    const { default: Page } = await import('../src/routes/proof/+page.svelte')
    const { load } = await import('../src/routes/proof/+page.server')
    const { EVIDENCE } = await import('../src/data/evidence')
    // The evidence is read and validated by the server load, at build time, so the browser never loads the validator.
    const data = await load()
    expect(data.evidence).toBe(EVIDENCE)
    const page = render(Page, { props: { data } })
    expect(page.getByRole('heading', { level: 1, name: 'Proof' })).toBeTruthy()
    if (EVIDENCE) {
      for (const golden of EVIDENCE.goldens) expect(page.getByRole('region', { name: golden.scenario })).toBeTruthy()
    } else {
      expect(page.getByText(/No evidence has been synced yet/)).toBeTruthy()
      expect(page.container.querySelector('code.hash')).toBeNull()
    }
  })
})
