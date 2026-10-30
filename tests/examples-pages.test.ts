import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import examplesJson from '../src/data/examples.json'
import { exampleIndex, getExample, getExamples } from '../src/data/examples'
import CommandMenu from '../src/lib/components/CommandMenu.svelte'
import IndexPage from '../src/routes/examples/+page.svelte'
import { load as indexLoad } from '../src/routes/examples/+page'
import ExamplePage from '../src/routes/examples/[id]/+page.svelte'
import { entries, load as exampleLoad } from '../src/routes/examples/[id]/+page'

// WEB.PLAY.5 (website playground spec §6 F1, §7.4, §8.1): /examples is the catalog's index, and each example has its
// own prerendered page whose preview runs the precompiled original once the page has loaded and the preview is near
// the screen. With reduced motion, nothing under /playground/ is requested before Play.

const root = resolve(import.meta.dirname, '..')
const pageData = async (id: string) => (await exampleLoad({ params: { id } } as never)) as { example: ReturnType<typeof getExample> & object; index: ReturnType<typeof exampleIndex> }

class FakeObserver {
  static instances: FakeObserver[] = []
  observed: Element[] = []
  constructor(readonly callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) { FakeObserver.instances.push(this) }
  observe(target: Element) { this.observed.push(target) }
  unobserve() {}
  disconnect() { this.observed = [] }
  intersect() { this.callback(this.observed.map(target => ({ isIntersecting: true, target }) as IntersectionObserverEntry), this as unknown as IntersectionObserver) }
}
const intersectAll = () => { for (const observer of FakeObserver.instances) observer.intersect() }

let fetches: string[]
let reducedMotion: boolean

beforeEach(() => {
  FakeObserver.instances = []
  fetches = []
  reducedMotion = false
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetches.push(String(url))
    return new Response('export default 1', { status: 200 })
  }))
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') && reducedMotion, media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('the example data', () => {
  it('has all 17 catalog examples, each findable by id', () => {
    expect(getExamples()).toHaveLength(17)
    expect(getExample('shapes-rects')?.title).toBe('rectangles that move, slide and spin')
    expect(getExample('nope')).toBeUndefined()
  })

  it('groups the index by module without carrying any source', () => {
    const index = exampleIndex()
    expect(index.flatMap(group => group.examples)).toHaveLength(17)
    expect(index.map(group => group.module)).toEqual(['core', 'shapes', 'textures', 'render', 'audio'])
    expect(JSON.stringify(index)).not.toContain("from '@mcthaydt/automata'")
  })
})

describe('/examples', () => {
  it('lists every example under its module, linking to its own page', async () => {
    const data = await indexLoad()
    const view = render(IndexPage, { props: { data } })
    const links = [...view.container.querySelectorAll('main a[href^="/examples/"], .page-shell a[href^="/examples/"]')].map(a => a.getAttribute('href'))
    expect(new Set(links)).toEqual(new Set(getExamples().map(example => '/examples/' + example.id)))
    expect(view.getByRole('heading', { name: /shapes/i })).toBeTruthy()
  })

  it('ignores the retired ?demo= query: the index is the same page whatever the query', async () => {
    expect(indexLoad.length).toBe(0)
  })

  it('runs nothing and requests nothing under /playground/', async () => {
    const view = render(IndexPage, { props: { data: await indexLoad() } })
    intersectAll()
    window.dispatchEvent(new Event('load'))
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(fetches).toEqual([])
  })
})

describe('/examples/<id>', () => {
  it('prerenders a page for every example', async () => {
    expect((await entries()).map(entry => entry.id).sort()).toEqual(getExamples().map(example => example.id).sort())
  })

  it('shows the synced source byte for byte, with its header fields and the list beside it', async () => {
    const data = await pageData('shapes-rects')
    const view = render(ExamplePage, { props: { data } })
    const synced = (examplesJson as { id: string; source: string }[]).find(example => example.id === 'shapes-rects')!.source
    expect(view.container.querySelector('[data-testid="static-code"] code')?.textContent).toBe(synced)
    expect(view.getByText(data.example.shows)).toBeTruthy()
    expect(view.getByRole('link', { name: data.example.title, current: 'page' })).toBeTruthy()
    expect(view.container.querySelectorAll('nav[aria-label="Examples"] a')).toHaveLength(17)
  })

  it('an example page starts the original after load with no input', async () => {
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' })
    const view = render(ExamplePage, { props: { data: await pageData('shapes-rects') } })
    intersectAll()
    await Promise.resolve()
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(fetches).toEqual([])
    delete (document as { readyState?: string }).readyState
    window.dispatchEvent(new Event('load'))
    intersectAll()
    await waitFor(() => expect(view.container.querySelector('iframe')).not.toBeNull())
    expect(fetches).toEqual(['/playground/compiled/shapes-rects.js'])
    const frame = view.container.querySelector('iframe')!
    expect(frame.getAttribute('src')).toBe('/playground/examples/shapes/rects/')
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(frame.hasAttribute('inert')).toBe(true)
    expect(view.container.querySelector('[data-preview]')?.getAttribute('data-preview')).toBe('starting')
    expect(view.getByText('Starting the preview…')).toBeTruthy()
  })

  it('waits until the preview is near the screen', async () => {
    const view = render(ExamplePage, { props: { data: await pageData('core-basic-window') } })
    window.dispatchEvent(new Event('load'))
    await Promise.resolve()
    expect(view.container.querySelector('iframe')).toBeNull()
    intersectAll()
    await waitFor(() => expect(view.container.querySelector('iframe')).not.toBeNull())
  })

  it('with reduced motion an example page requests nothing under /playground/ before Play', async () => {
    reducedMotion = true
    const view = render(ExamplePage, { props: { data: await pageData('shapes-rects') } })
    window.dispatchEvent(new Event('load'))
    intersectAll()
    await Promise.resolve()
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(fetches).toEqual([])
    expect(view.getByText('Press Play to start the example. Once it runs, edits update it live.')).toBeTruthy()
    const play = view.getByRole('button', { name: 'Play' })
    await fireEvent.click(play)
    await waitFor(() => expect(view.container.querySelector('iframe')).not.toBeNull())
    expect(fetches).toEqual(['/playground/compiled/shapes-rects.js'])
  })

  it('shows the poster with the example’s title until a run is on show', async () => {
    const view = render(ExamplePage, { props: { data: await pageData('shapes-rects') } })
    expect(view.container.querySelector('[data-testid="preview-poster"]')?.textContent).toContain('rectangles that move, slide and spin')
  })

  it('keeps the precompiled originals in step with the catalog', () => {
    for (const example of getExamples()) expect(readFileSync(resolve(root, 'static/playground/compiled', example.id + '.js'), 'utf8')).toContain('//# sourceURL=examples/' + example.path)
  })
})

describe('the command menu', () => {
  it('opens an example at its own page, not the retired ?demo= gallery', async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open') }
    const view = render(CommandMenu, { props: { isOpen: true } })
    await fireEvent.input(view.getByRole('searchbox', { name: /search/i }), { target: { value: 'shapes-rects' } })
    const links = view.getAllByRole('link').map(link => link.getAttribute('href'))
    expect(links).toContain('/examples/shapes-rects')
    expect(links.some(href => href?.includes('?demo='))).toBe(false)
  })
})
