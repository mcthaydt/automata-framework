import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Start from '../src/routes/start/+page.svelte'

// The worked double-jump demo, its workshop sources and their recorded test run left with the sync scripts (task
// 10.2); task 18.2 rewrites this page around create-game.
describe('First-change onboarding', () => {
  it('connects setup and a bounded task to the next changes', () => {
    const view = render(Start)
    expect(view.getByRole('region', { name: 'From your terminal' }).textContent).toContain('pnpm --filter @af-examples/base-2d dev')
    expect(view.getByRole('region', { name: 'First task to copy' }).textContent).toContain('third jump is refused')
    const task = view.getByRole('region', { name: 'First task to copy' }).closest('figure')!
    expect(task.querySelector('button')).toBeTruthy()
    expect(view.getByRole('link', { name: 'Read the room tests' }).getAttribute('href')).toContain('room.test.ts')
  })
})
