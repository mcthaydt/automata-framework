import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CommandMenu from '#src/features/search/CommandMenu.svelte'

// The Editor page is cut: searching "editor" opens the editor itself, which is not one of the site's routes.
describe('CommandMenu and the editor', () => {
  it('opens the editor at /editor/app/, loading it whole', async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
    const view = render(CommandMenu, { props: { isOpen: true } })
    await fireEvent.input(view.getByRole('searchbox', { name: /search/i }), {
      target: { value: 'draw your levels' },
    })
    const link = view.getByRole('link', { name: 'Editor' })
    expect(link.getAttribute('href')).toBe('/editor/app/')
    expect(link.hasAttribute('data-sveltekit-reload')).toBe(true)
    // Only the editor is loaded whole: the rest are the site's routes.
    for (const other of view.getAllByRole('link').filter((candidate) => candidate !== link))
      expect(other.hasAttribute('data-sveltekit-reload'), other.getAttribute('href') ?? '').toBe(false)
  })
})
