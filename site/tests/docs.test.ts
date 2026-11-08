import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DocsPage from '../src/features/docs/DocsPage.svelte'
import { getDocSections } from '../src/features/docs/docs-loader'

describe('Docs Page & Loader', () => {
  it('loads core documentation sections from monorepo docs/', () => {
    const sections = getDocSections()
    expect(sections.length).toBeGreaterThan(0)
    const titles = sections.map((s) => s.title)
    expect(titles).toContain('Overview & Vision')
    expect(titles).toContain('ECS Simulation & Determinism')
    expect(titles).toContain('Zero-Eval CSP & Host Security')
  })

  it('renders documentation layout in UI', () => {
    const { getAllByText } = render(DocsPage)
    expect(getAllByText(/Overview & Vision/i).length).toBeGreaterThan(0)
  })
})
