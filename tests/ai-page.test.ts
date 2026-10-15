import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Page from '../src/routes/ai/+page.svelte'

describe('AI guidance', () => {
  it('offers project context and verification instead of guarantees or guessed installers', () => {
    const view = render(Page)
    expect(view.getByRole('heading', { level: 1 }).textContent).toContain('Context for your agent')
    expect(view.getByText(/Claude Code, Cursor/)).toBeTruthy()
    expect(view.getByRole('link', { name: /view llms.txt/i }).getAttribute('href')).toBe('/llms.txt')
    expect(view.container.textContent).not.toMatch(/Eliminate hallucinations|on the first attempt|npx skills add|agy skill install/)
    expect(view.getAllByText(/simulation/i).length).toBeGreaterThan(0)
  })
})
