import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Split from '#src/shared/ui/layout/Split.svelte'
import { splitMode } from '#src/shared/ui/layout/split.ts'
import { textSnippet } from '#src/testing/fixtures/text-snippet.ts'

// splitMode's cases from FloorFifty tests/client/ui/layout/helpers.test.ts at ac72660.
describe('splitMode (M4 spec §4.8, Split)', () => {
  it.each([
    [700, 300, 16, 'row'],
    [616, 300, 16, 'row'],
    [615, 300, 16, 'stack'],
    [0, 300, 16, 'stack'],
  ] as const)('%i px for two %i px columns and a %i px gap: %s', (available, min, gap, mode) => {
    expect(splitMode(available, min, gap)).toBe(mode)
  })
})

describe('Split', () => {
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

  function open(): HTMLElement {
    const host = document.createElement('div')
    document.body.append(host)
    component = mount(Split, {
      target: host,
      props: { min: 300, first: textSnippet('First'), second: textSnippet('Second') },
    })
    flushSync()
    return host.querySelector<HTMLElement>('[data-split]') as HTMLElement
  }

  it('stacks until it is measured, and shows both panes', () => {
    const split = open()
    expect(split.dataset.split).toBe('stack')
    expect(split.textContent).toContain('First')
    expect(split.textContent).toContain('Second')
  })

  it('goes side by side once its measured width holds both columns and the gap, and back', () => {
    const resize = stubWidth()
    const split = open()
    resize(616)
    expect(split.dataset.split).toBe('row')
    resize(615)
    expect(split.dataset.split).toBe('stack')
  })
})
