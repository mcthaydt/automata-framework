import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Home from '#src/features/home/Home.svelte'

// Home's "Languages" card says how many languages a new game ships. The count is the framework's (siteFacts reads it from
// the default locales), so it is not typed in the words: here the facts say three, and Home must say three.
vi.mock('virtual:framework/facts', async (original) => {
  const real = (await original<{ default: object }>()).default
  return { default: { ...real, languages: 3 } }
})

describe("Home's languages card", () => {
  it('says the number of languages the facts give, in words, and not a number typed on the page', () => {
    const view = render(Home)
    const list = view.getByRole('list', { name: 'Built into every game' })
    const item = [...list.querySelectorAll('li')].find(
      (li) => li.querySelector('h3')?.textContent === 'Languages',
    )
    expect(item?.textContent).toContain('Menus in three languages from the first run.')
    expect(item?.textContent).not.toMatch(/six/i)
  })
})
