import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CommandMenu from '../src/lib/components/CommandMenu.svelte'
import { getApiReference, latestApiVersion } from '../src/lib/api-reference'

// M10.4: search reaches the complete generated reference, not only the selected APIs, and links to the package page.
describe('CommandMenu searches the complete API', () => {
  it('finds an export that the selected-API cheatsheet does not carry, and links to its package page', async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open') }
    const version = latestApiVersion()
    const reference = getApiReference(version)!
    const sim = reference.packages.find((p) => p.slug === 'automata-sim')!
    const target = sim.entryPoints.flatMap((e) => e.entries).find((e) => /^[a-z][A-Za-z]{9,}$/.test(e.name))!
    const view = render(CommandMenu, { props: { isOpen: true } })
    await fireEvent.input(view.getByRole('searchbox', { name: /search/i }), { target: { value: target.name } })
    await waitFor(() => {
      const hrefs = view.getAllByRole('link').map((l) => l.getAttribute('href'))
      expect(hrefs.some((h) => h?.startsWith(`/api/${version}/`) && h.endsWith('#' + target.name))).toBe(true)
    })
  })
})
