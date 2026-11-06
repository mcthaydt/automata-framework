import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Page from '../src/routes/ai/+page.svelte'

describe('AI guidance', () => {
  it('provides task prompts, review criteria, and links back to the API', () => {
    const view = render(Page)
    expect(view.getByRole('navigation', { name: 'AI guide sections' })).toBeTruthy()
    expect(view.getByRole('heading', { name: 'Choose a task prompt.' })).toBeTruthy()
    for (const title of ['Add a collectible', 'Add a dash', 'Make jumps feel good', 'Author a room', 'Save progress', 'Prepare a release']) {
      expect(view.getByText(title).closest('summary')).toBeTruthy()
    }
    expect(view.getByRole('heading', { name: 'Review the result.' })).toBeTruthy()
    expect(view.getByRole('link', { name: 'Browse the API reference' }).getAttribute('href')).toBe('/cheatsheet')
    expect(view.getByRole('region', { name: 'Project context' }).textContent).toContain('Acceptance criteria')
    const taskSection = view.container.querySelector('#task-prompts')!
    const setup = view.getByRole('region', { name: 'Required agent skills', hidden: true })
    expect(taskSection.compareDocumentPosition(setup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers project context and verification instead of guarantees or guessed installers', async () => {
    const view = render(Page)
    expect(view.getByRole('heading', { level: 1 }).textContent).toMatch(/Your agent.*Your game/)
    expect(view.getByText(/Claude Code, Cursor/)).toBeTruthy()
    expect(view.getByRole('link', { name: /view llms.txt/i }).getAttribute('href')).toBe('/llms.txt')
    expect(view.container.textContent).not.toMatch(/Eliminate hallucinations|on the first attempt|npx skills add (?!https:\/\/github\.com\/pixijs\/pixijs-skills)|agy skill install/)
    expect(view.container.textContent).toContain('npx skills add https://github.com/pixijs/pixijs-skills')
    await fireEvent.click(view.getByText('Set up your coding agent'))
    expect(view.getByRole('link', { name: 'Official PixiJS skills installation' }).getAttribute('href')).toBe('https://github.com/pixijs/pixijs-skills#installing')
    expect(view.getAllByText(/simulation/i).length).toBeGreaterThan(0)
  })
})
