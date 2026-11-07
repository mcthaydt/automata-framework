import { fireEvent, render, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { getDocSections } from '../src/data/docs-loader'
import Start from '../src/routes/start/+page.svelte'

describe('Audience onboarding', () => {
  it('offers all five engine backgrounds in canonical documentation', () => {
    const docs = getDocSections()
    for (const slug of [
      'from-unity',
      'from-godot',
      'from-unreal',
      'from-gamemaker',
      'from-web',
      'agent-setup',
      'audience',
      'faq',
    ])
      expect(
        docs.find((doc) => doc.slug === slug),
        slug,
      ).toBeTruthy()
  })
  it('keeps every command copyable while offering an optional readiness checklist', async () => {
    const view = render(Start)
    const copies = () => view.getAllByRole('button', { name: 'Copy command' })
    expect(copies()).toHaveLength(4)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    for (const label of [
      'Superpowers is installed for this agent',
      'The PixiJS v8 skill collection is installed',
      'My agent reported and loaded the required skills',
    ])
      await fireEvent.click(view.getByLabelText(label))
    expect(view.getByText(/3 of 3 confirmed by you/)).toBeTruthy()
    expect(view.getByRole('group', { name: 'Skill readiness' })).toBeTruthy()
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    expect(copies()).toHaveLength(4)
  })
})
