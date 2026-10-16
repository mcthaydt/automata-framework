import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Start from '../src/routes/start/+page.svelte'

describe('First-change onboarding', () => {
  it('connects setup, a bounded task, real source and recorded tests to a playable result', async () => {
    const view = render(Start)
    expect(view.getByRole('region', { name: 'From your terminal' }).textContent).toContain('pnpm --filter @af-examples/base-2d dev')
    expect(view.getByRole('region', { name: 'First task to copy' }).textContent).toContain('Do not change player-move.system.ts')
    expect(view.getByRole('region', { name: 'First task to copy' }).textContent).toContain('third jump is refused')
    const task = view.getByRole('region', { name: 'First task to copy' }).closest('figure')!
    expect(task.querySelector('button')).toBeTruthy()
    expect(view.container.textContent).toContain('tests passed when this example was built')
    expect(view.container.querySelector('iframe')).toBeNull()
    await fireEvent.click(view.getAllByRole('button', { name: 'Play demo' })[0])
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe('/demos/first-change/index.html')
    expect(view.getByRole('link', { name: 'Read the room tests' }).getAttribute('href')).toContain('room.test.ts')
    await fireEvent.click(view.getByText('See the source and test results'))
    await fireEvent.click(view.getByText('Read the double-jump system'))
    expect(view.getByRole('region', { name: 'workshop/double-jump.system.ts' }).textContent).toContain('ctx.emit(Jumped')
  })
})
