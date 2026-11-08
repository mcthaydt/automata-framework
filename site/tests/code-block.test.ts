import { render, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeBlock from '../src/shared/components/CodeBlock.svelte'
import { highlightCode } from '../src/shared/utils/highlight'

// QB.3h. Highlighting a file costs seconds of main-thread time on a phone (shiki's tokenizer was 2.3 s of a 2.9 s long
// task on /start under Lighthouse's 4× slowdown), and every block used to pay it on mount, seen or not. A block now
// highlights when it is near the screen; the plain code shows until then.
vi.mock('../src/shared/utils/highlight', () => ({
  highlightCode: vi.fn(async (code: string) => `<pre class="shiki"><code>highlighted:${code}</code></pre>`),
}))

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
  /** Reports the observed block as entering (or not entering) the observer's margin. */
  report(isIntersecting: boolean) {
    this.callback(
      this.observed.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    )
  }
}

beforeEach(() => {
  FakeObserver.instances = []
  vi.mocked(highlightCode).mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CodeBlock', () => {
  // The plain code can now stay on the page for a long time (a block in a closed <details> is never highlighted until it
  // opens), and a scrollable <pre> that the keyboard cannot reach is an axe violation (scrollable-region-focusable).
  // shiki's own <pre> carries tabindex="0"; the plain one must too.
  it('lets the keyboard scroll the plain code, as it does the highlighted code', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(CodeBlock, {
      props: { code: 'const far = 1', lang: 'typescript', filename: 'far.ts' },
    })
    await Promise.resolve()
    expect(view.container.querySelector('pre')?.getAttribute('tabindex')).toBe('0')
  })

  it('shows the plain code and does not highlight while the block is far from the screen', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(CodeBlock, {
      props: { code: 'const far = 1', lang: 'typescript', filename: 'far.ts' },
    })
    await Promise.resolve()
    expect(FakeObserver.instances).toHaveLength(1)
    expect(FakeObserver.instances[0].observed[0]).toBe(view.container.querySelector('figure'))
    FakeObserver.instances[0].report(false)
    await Promise.resolve()
    expect(highlightCode).not.toHaveBeenCalled()
    expect(view.getByRole('region', { name: 'far.ts' }).textContent).toBe('const far = 1')
  })

  it('looks ahead by a screenful, so the highlight is there by the time the block is reached', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    render(CodeBlock, { props: { code: 'x' } })
    expect(FakeObserver.instances[0].options?.rootMargin).toBe('300px')
  })

  it('highlights once, when the block nears the screen, and then stops watching', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(CodeBlock, {
      props: { code: 'const near = 2', lang: 'typescript', filename: 'near.ts' },
    })
    FakeObserver.instances[0].report(true)
    await waitFor(() =>
      expect(view.getByRole('region', { name: 'near.ts' }).textContent).toBe('highlighted:const near = 2'),
    )
    expect(highlightCode).toHaveBeenCalledTimes(1)
    expect(highlightCode).toHaveBeenCalledWith('const near = 2', 'typescript')
    expect(FakeObserver.instances[0].disconnected).toBe(true)
  })

  it('stops watching when the block goes away before it was ever near the screen', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(CodeBlock, { props: { code: 'x' } })
    view.unmount()
    expect(FakeObserver.instances[0].disconnected).toBe(true)
    expect(highlightCode).not.toHaveBeenCalled()
  })

  it('highlights at once where the browser has no IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const view = render(CodeBlock, {
      props: { code: 'const now = 3', lang: 'typescript', filename: 'now.ts' },
    })
    await waitFor(() =>
      expect(view.getByRole('region', { name: 'now.ts' }).textContent).toBe('highlighted:const now = 3'),
    )
    expect(highlightCode).toHaveBeenCalledTimes(1)
  })

  it('highlights new code at once once the block has been near the screen', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const view = render(CodeBlock, { props: { code: 'first', filename: 'f.ts' } })
    FakeObserver.instances[0].report(true)
    await waitFor(() =>
      expect(view.getByRole('region', { name: 'f.ts' }).textContent).toBe('highlighted:first'),
    )
    await view.rerender({ code: 'second', filename: 'f.ts' })
    await waitFor(() =>
      expect(view.getByRole('region', { name: 'f.ts' }).textContent).toBe('highlighted:second'),
    )
    expect(highlightCode).toHaveBeenCalledTimes(2)
  })
})
