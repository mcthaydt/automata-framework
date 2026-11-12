import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import HomeEditor from '#src/features/home/HomeEditor.svelte'

// Home's "Try the level editor" goes straight to the editor; the page that used to sit between is cut.
describe('Home’s editor section', () => {
  it('links to the editor at /editor/app/, loading it whole', () => {
    const view = render(HomeEditor)
    const link = view.getByRole('link', { name: /Try the level editor/ })
    expect(link.getAttribute('href')).toBe('/editor/app/')
    expect(link.hasAttribute('data-sveltekit-reload')).toBe(true)
  })
})
