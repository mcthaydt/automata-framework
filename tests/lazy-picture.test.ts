import { render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LazyPicture from '../src/lib/components/LazyPicture.svelte'

// QB.3j. Native `loading="lazy"` leaves the distance at which a picture starts to load to the browser: Chromium 153
// fetched the home page's gallery pictures 1,500 to 2,000 px below the fold right after the poster, and Lighthouse
// charged them to the poster's LCP. A picture here is not in the page until the reader is near it.
class FakeObserver {
  static instances: FakeObserver[] = []
  observed: Element[] = []
  disconnected = false
  constructor(readonly callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) { FakeObserver.instances.push(this) }
  observe(element: Element) { this.observed.push(element) }
  disconnect() { this.disconnected = true }
  unobserve() {}
  takeRecords() { return [] }
  report(isIntersecting: boolean) {
    this.callback(this.observed.map(target => ({ isIntersecting, target }) as IntersectionObserverEntry), this as unknown as IntersectionObserver)
  }
}

const props = { src: '/previews/double-jump.jpg', alt: 'Double jump example', width: 1280, height: 720, aspect: '16 / 10', sizes: '(max-width: 700px) 100vw, 40vw' }

beforeEach(() => { FakeObserver.instances = [] })
afterEach(() => { vi.unstubAllGlobals() })

describe('LazyPicture', () => {
  it('holds the picture’s place and requests nothing while the reader is far away', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(LazyPicture, { props })
    await Promise.resolve()
    const box = view.container.querySelector('.lazy-picture') as HTMLElement
    expect(box.style.aspectRatio).toBe('16 / 10')
    expect(view.container.querySelector('img')).toBeNull()
    expect(view.container.querySelector('source')).toBeNull()
    expect(FakeObserver.instances).toHaveLength(1)
    expect(FakeObserver.instances[0].observed).toEqual([box])
    expect(FakeObserver.instances[0].options?.rootMargin).toBe('400px')
  })

  it('adds the picture, with its sources, when the reader gets near, and stops watching', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(LazyPicture, { props })
    await Promise.resolve()
    FakeObserver.instances[0].report(true)
    await Promise.resolve()
    const img = view.container.querySelector('picture img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/previews/double-jump.jpg')
    expect(img.getAttribute('alt')).toBe('Double jump example')
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['1280', '720'])
    const source = view.container.querySelector('picture source') as HTMLSourceElement
    expect(source.getAttribute('type')).toBe('image/webp')
    expect(source.getAttribute('srcset')).toBe('/previews/double-jump-640.webp 640w, /previews/double-jump.webp 1280w')
    expect(source.getAttribute('sizes')).toBe(props.sizes)
    expect(FakeObserver.instances[0].disconnected).toBe(true)
  })

  it('keeps waiting when the observer reports the box is still far away', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(LazyPicture, { props })
    await Promise.resolve()
    FakeObserver.instances[0].report(false)
    await Promise.resolve()
    expect(view.container.querySelector('img')).toBeNull()
    expect(FakeObserver.instances[0].disconnected).toBe(false)
  })

  it('shows the picture at once where there is no IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const view = render(LazyPicture, { props })
    await Promise.resolve()
    expect(view.container.querySelector('picture img')?.getAttribute('src')).toBe('/previews/double-jump.jpg')
  })
})
