import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { getDocSections } from '../src/data/docs-loader'
import DocsPage from '../src/routes/docs/+page.svelte'

describe('Docs Page & Loader', () => {
  it('loads core documentation sections from monorepo docs/', () => {
    const sections = getDocSections()
    expect(sections.length).toBeGreaterThan(0)
    const titles = sections.map((s) => s.title)
    expect(titles).toContain('Overview & Vision')
    expect(titles).toContain('ECS Sim vs. Presentation')
    expect(titles).toContain('No-Eval CSP & Ruken Rules')
  })

  it('renders documentation layout in UI', () => {
    const { getByText, getAllByText } = render(DocsPage)
    expect(getByText(/Spartan Documentation/i)).toBeTruthy()
    expect(getAllByText(/Overview & Vision/i).length).toBeGreaterThan(0)
  })
})
