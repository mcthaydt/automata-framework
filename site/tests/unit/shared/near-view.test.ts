import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NearView from '../../../src/shared/components/NearView.svelte'

// QB.3j: a picture far below the fold is not in the page, so the browser cannot fetch it, until the reader is near it.
class FakeObserver {
  static instances: FakeObserver[] = []
  observed: Element[] = []
  disconnected = false
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.instances.push(this)
  }
  observe(element: Element) {
    this.observed.push(element)
  }
  disconnect() {
    this.disconnected = true
  }
  unobserve() {}
  takeRecords() {
    return []
  }
  report(isIntersecting: boolean) {
    this.callback(
      this.observed.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    )
  }
}

const children = createRawSnippet(() => ({
  render: () => '<img src="/previews/editor.jpg" alt="The editor">',
}))
const visibleImage = (container: HTMLElement) => container.querySelector('.near-view > img')

beforeEach(() => {
  FakeObserver.instances = []
})
afterEach(() => vi.unstubAllGlobals())

describe('NearView', () => {
  it('holds its content back while the reader is far away, watching 400 px ahead', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(NearView, { props: { children } })
    await Promise.resolve()
    expect(visibleImage(view.container)).toBeNull()
    expect(FakeObserver.instances[0]?.observed).toEqual([view.container.querySelector('.near-view')])
    expect(FakeObserver.instances[0]?.options?.rootMargin).toBe('400px')
    FakeObserver.instances[0]?.report(false)
    await Promise.resolve()
    expect(visibleImage(view.container)).toBeNull()
  })

  it('shows it when the reader gets near, and stops watching', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(NearView, { props: { children } })
    await Promise.resolve()
    FakeObserver.instances[0]?.report(true)
    await Promise.resolve()
    expect(visibleImage(view.container)?.getAttribute('alt')).toBe('The editor')
    expect(FakeObserver.instances[0]?.disconnected).toBe(true)
  })

  it('shows it at once where there is no IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const view = render(NearView, { props: { children } })
    await Promise.resolve()
    expect(visibleImage(view.container)).not.toBeNull()
  })
})
