import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PagerDots from '#src/shared/ui/layout/PagerDots.svelte'
import { pagerMode } from '#src/shared/ui/layout/pager.ts'

// The pager mode and the pager dots.
describe('pagerMode (M4 spec §4.8, PagerDots)', () => {
  it.each([
    [8, 9, Number.POSITIVE_INFINITY, 44, 'dots'],
    [9, 9, Number.POSITIVE_INFINITY, 44, 'dots'],
    [10, 9, Number.POSITIVE_INFINITY, 44, 'counter'],
    [4, 9, 200, 44, 'dots'], // 176 px of dots in 200
    [5, 9, 200, 44, 'counter'], // 220 px would wrap
  ] as const)('%i pages, max %i, in %f px of %i px dots: %s', (count, max, available, dot, mode) => {
    expect(pagerMode(count, max, available, dot)).toBe(mode)
  })

  it('defaults to nine dots of 44 px with unlimited room', () => {
    expect(pagerMode(9)).toBe('dots')
    expect(pagerMode(10)).toBe('counter')
  })
})

describe('PagerDots', () => {
  let component: ReturnType<typeof mount> | undefined
  afterEach(() => {
    if (component !== undefined) unmount(component)
    component = undefined
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  /** jsdom has no ResizeObserver: this one reports the width a test gives it. */
  function stubWidth(): (width: number) => void {
    let report: ResizeObserverCallback = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          report = callback
        }
        observe(): void {}
        disconnect(): void {}
      },
    )
    return (width) => {
      report([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
      flushSync()
    }
  }

  function open(props: Record<string, unknown>): HTMLElement {
    const target = document.createElement('div')
    document.body.append(target)
    component = mount(PagerDots, { target, props: { label: 'Pages', ...props } as never })
    flushSync()
    return target
  }

  it('shows one dot per page, the current one marked, and reports a tap', () => {
    const onselect = vi.fn()
    const target = open({ count: 5, index: 2, onselect })
    const dots = target.querySelectorAll<HTMLButtonElement>('[data-pager-dot]')
    expect(dots).toHaveLength(5)
    expect(dots[2]?.getAttribute('aria-current')).toBe('true')
    expect(dots[0]?.hasAttribute('aria-current')).toBe(false)
    dots[4]?.click()
    expect(onselect).toHaveBeenCalledWith(4)
  })

  it('names each dot through dotLabel, Page n of m by default', () => {
    const target = open({ count: 2, index: 0 })
    const names = [...target.querySelectorAll('[data-pager-dot]')].map((dot) =>
      dot.getAttribute('aria-label'),
    )
    expect(names).toEqual(['Page 1 of 2', 'Page 2 of 2'])
    const named = open({ count: 2, index: 0, dotLabel: (position: number) => `Pack ${position}` })
    expect(named.querySelector('[data-pager-dot]')?.getAttribute('aria-label')).toBe('Pack 1')
  })

  it('becomes a counter in a polite live region past nine pages, rather than a second row', () => {
    const target = open({ count: 11, index: 2 })
    expect(target.querySelectorAll('[data-pager-dot]')).toHaveLength(0)
    const counter = target.querySelector('[data-testid="pager-counter"]')
    expect(counter?.textContent).toBe('3 / 11')
    expect(counter?.getAttribute('aria-live')).toBe('polite')
  })

  it('becomes a counter when it is measured too narrow for the dots', () => {
    const resize = stubWidth()
    const target = open({ count: 6, index: 0 })
    resize(200) // six 44 px dots need 264
    expect(target.querySelector('[data-testid="pager-counter"]')?.textContent).toBe('1 / 6')
  })
})
