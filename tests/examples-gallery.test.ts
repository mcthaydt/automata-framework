import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { getDemosCatalog } from '../src/data/demos'
import { demoPoster, previewSrcset } from '../src/lib/previews'
import ExamplesPage from '../src/routes/examples/+page.svelte'
import { examplesData } from './helpers/page-data'

// QB.3h. The gallery used to start its demo on arrival. The demo's frame loop then ran beside the page, and under
// Lighthouse's mobile throttling that was about 60 tasks of 160 to 530 ms (8.8 s of blocking time on /examples). Like the
// home page and /start, the gallery now waits for "Play demo" and shows the demo's preview image where there is one.
const root = resolve(import.meta.dirname, '..')

describe('the examples gallery', () => {
  it('does not start the demo until Play is pressed', async () => {
    const demo = getDemosCatalog().find(item => item.slug === 'renderer-2d')!
    const view = render(ExamplesPage, { props: { data: examplesData(demo.slug) } })
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(view.queryByRole('button', { name: 'Stop demo' })).toBeNull()
    await fireEvent.click(view.getByRole('button', { name: 'Play demo' }))
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe(demo.bundleUrl)
    expect(view.getByRole('button', { name: 'Stop demo' })).toBeTruthy()
  })

  it('shows the demo’s preview image while it waits', () => {
    const view = render(ExamplesPage, { props: { data: examplesData('renderer-2d') } })
    expect(view.container.querySelector('img.demo-poster')?.getAttribute('src')).toBe('/previews/renderer-2d.jpg')
  })

  it('still offers Play for a demo with no preview image yet', async () => {
    const view = render(ExamplesPage, { props: { data: examplesData('boot-and-flow') } })
    expect(view.container.querySelector('img.demo-poster')).toBeNull()
    expect(view.container.querySelector('iframe')).toBeNull()
    await fireEvent.click(view.getByRole('button', { name: 'Play demo' }))
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe('/demos/runtime/boot-and-flow/index.html')
  })
})

describe('demoPoster', () => {
  it('names the preview a demo has, and nothing for a demo without one', () => {
    expect(demoPoster('base-2d')).toBe('/previews/emberwick.jpg')
    expect(demoPoster('renderer-2d')).toBe('/previews/renderer-2d.jpg')
    expect(demoPoster('boot-and-flow')).toBeUndefined()
    expect(demoPoster('ui-primitives')).toBeUndefined()
    expect(demoPoster('no-such-demo')).toBeUndefined()
  })

  it('only names previews that ship, with the WebP sizes the picture element asks for', () => {
    const posters = getDemosCatalog().map(demo => demoPoster(demo.slug)).filter((poster): poster is string => poster !== undefined)
    expect(posters.length).toBeGreaterThan(0)
    for (const poster of posters) {
      expect(() => previewSrcset(poster), poster).not.toThrow()
      const base = poster.replace(/\.jpg$/, '')
      for (const file of [poster, base + '.webp', base + '-640.webp']) expect(existsSync(resolve(root, 'static' + file)), file).toBe(true)
    }
  })
})
