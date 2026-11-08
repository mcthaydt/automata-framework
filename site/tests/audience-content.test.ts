import { fireEvent, render, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { getDocSections } from '../src/data/docs-loader'
import Home from '../src/routes/+page.svelte'
import { homeData } from './helpers/page-data'
import Start from '../src/routes/start/+page.svelte'
import Showcase from '../src/routes/showcase/+page.svelte'

describe('Audience onboarding', () => {
  it('offers all five engine backgrounds in canonical documentation', () => {
    const docs = getDocSections()
    for (const slug of ['from-unity', 'from-godot', 'from-unreal', 'from-gamemaker', 'from-web', 'agent-setup', 'audience', 'faq']) expect(docs.find(doc => doc.slug === slug), slug).toBeTruthy()
  })
  it('makes fit, limitations and FAQ available from the homepage', () => {
    const view = render(Home, { props: { data: homeData } })
    expect(view.getByRole('heading', { name: 'Who this is for' })).toBeTruthy()
    expect(view.getByRole('heading', { name: 'Who this is not for' })).toBeTruthy()
    expect(view.getByRole('heading', { name: 'FAQ' })).toBeTruthy()
    expect(view.getByRole('link', { name: 'Browse the community showcase' }).getAttribute('href')).toBe('/showcase')
  })
  it('keeps prompts copyable while offering an optional readiness checklist', async () => {
    const view = render(Start)
    const region = view.getByRole('region', { name: 'First task to copy' })
    expect(region.textContent).toContain('Confirm Superpowers')
    const task = within(region.closest('figure')!)
    expect(task.getByRole('button', { name: 'Copy code' })).toBeTruthy()
    await fireEvent.click(view.getByText('Set up your coding agent'))
    for (const label of ['Superpowers is installed for this agent', 'The PixiJS v8 skill collection is installed', 'My agent reported and loaded the required skills']) await fireEvent.click(view.getByLabelText(label))
    expect(view.getByText(/3 of 3 confirmed by you/)).toBeTruthy()
    expect(view.getByRole('group', { name: 'Skill readiness' })).toBeTruthy()
    expect(task.getByRole('button', { name: 'Copy code' })).toBeTruthy()
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    expect(task.getByRole('button', { name: 'Copy code' })).toBeTruthy()
  })
  it('separates the community showcase from starter and reference projects', () => {
    const view = render(Showcase)
    expect(view.getByRole('heading', { name: 'Games from the community' })).toBeTruthy()
    const link = view.getByRole('link', { name: 'Submit your game' })
    expect(link.getAttribute('href')).toContain('github.com/mcthaydt/automata-framework/issues/new')
    expect(view.getByText('No community submissions have been published here yet.')).toBeTruthy()
  })
})
