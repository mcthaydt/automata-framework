import { fireEvent, render, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Page from '../src/routes/cheatsheet/+page.svelte'

describe('API documentation', () => {
  it('shows parameters, return values, examples, and source links', () => {
    const view = render(Page)
    const entry = within(view.getByRole('heading', { name: 'createSim', level: 3 }).closest('article')!)
    expect(entry.getByRole('table', { name: 'createSim parameters' })).toBeTruthy()
    expect(entry.getByText('options.seed')).toBeTruthy()
    expect(entry.getByText('Promise<Sim>')).toBeTruthy()
    expect(view.getByRole('region', { name: 'Simulation example' }).textContent).toContain('await createSim')
    expect(view.getByRole('link', { name: 'Simulation source' }).getAttribute('href')).toContain('/packages/sim/src/index.ts')
  })

  it('searches usage details and combines search with the package filter', async () => {
    const view = render(Page)
    await fireEvent.input(view.getByRole('searchbox'), { target: { value: 'duplicate-seq' } })
    expect(view.getByRole('heading', { name: 'step', level: 3 })).toBeTruthy()
    expect(view.queryByRole('heading', { name: 'createRng', level: 3 })).toBeNull()
    await fireEvent.change(view.getByLabelText('Package'), { target: { value: '@mcthaydt/automata-runtime' } })
    expect(view.getByRole('status').textContent).toMatch(/No API entries match/)
    await fireEvent.input(view.getByRole('searchbox'), { target: { value: 'pause menu' } })
    expect(view.getByRole('heading', { name: 'Time', level: 3 })).toBeTruthy()
  })

  it('restores a filtered module before the browser follows its anchor', async () => {
    const view = render(Page)
    await fireEvent.input(view.getByRole('searchbox'), { target: { value: 'duplicate-seq' } })
    let targetExistsAtNavigation = false
    window.addEventListener('click', () => { targetExistsAtNavigation = document.getElementById('ui') !== null }, { once: true })
    await fireEvent.click(view.getByRole('navigation', { name: 'API modules' }).querySelector('a[href="#ui"]')!)
    expect(targetExistsAtNavigation).toBe(true)
  })
})
