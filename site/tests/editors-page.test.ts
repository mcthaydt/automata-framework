import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { EDITORS } from '../src/data/editors'
import Page from '../src/routes/editors/+page.svelte'

// M10.6: the editors page names each editor of the suite spec and claims none is released. The try-it build waits on the M10.0 decision.
describe('/editors', () => {
  it('lists all nine editors, grouped by where they live', () => {
    const view = render(Page)
    expect(EDITORS).toHaveLength(9)
    for (const editor of EDITORS) expect(view.getByText(editor.name, { selector: 'strong' }), editor.name).toBeTruthy()
    expect(view.getByRole('heading', { level: 2, name: 'In the framework' }).parentElement?.querySelectorAll('li')).toHaveLength(5)
    expect(view.getByRole('heading', { level: 2, name: 'In Automata Plus' }).parentElement?.querySelectorAll('li')).toHaveLength(4)
  })

  it('says none is released, offers no try-it build or download, and states the cost as the framework does', () => {
    const view = render(Page)
    const text = view.container.textContent ?? ''
    expect(text).toContain('None of these is released yet')
    expect(text).toContain('Plus is free')
    expect(text).toContain('iOS and Android apps, bought once')
    expect(view.container.querySelector('iframe, a[download], a[href$=".dmg"], a[href$=".apk"]')).toBeNull()
    expect(EDITORS.every((e) => e.status === 'in-development')).toBe(true)
  })
})
