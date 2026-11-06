import { installFakeResizeObserver, textSnippet } from '@mcthaydt/automata-testing'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionBar from '#src/layout/ActionBar.svelte'
import type { BarAction } from '#src/layout/action-bar.ts'

// Ported from FloorFifty tests/client/ui/layout/action-bar.test.ts at 122a220 (pad guard and sounds stay in the game).
let component: ReturnType<typeof mount> | undefined
let fake: ReturnType<typeof installFakeResizeObserver>
beforeEach(() => {
  fake = installFakeResizeObserver()
})
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
  fake.restore()
})

const actions = (onSelect = vi.fn()): BarAction[] => [
  { id: 'play-again', label: 'Play again', kind: 'primary', onSelect },
  { id: 'watch-replay', label: 'Watch replay', shortLabel: 'Replay', kind: 'secondary', onSelect },
  { id: 'return-to-menu', label: 'Return to menu', shortLabel: 'Menu', kind: 'secondary', onSelect },
]

function open(widths: [number, number, number], list = actions()) {
  let available = 0
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(ActionBar, {
    target: host,
    props: { actions: list, testId: 'results-actions', measure: () => ({ available, widths }) },
  })
  flushSync()
  const bar = host.querySelector<HTMLElement>('[data-testid="results-actions"]') as HTMLElement
  return {
    bar,
    visible: bar.querySelector('[data-row="visible"]') as HTMLElement,
    resize(width: number) {
      available = width
      fake.resize(width)
      flushSync()
    },
  }
}

describe('ActionBar', () => {
  it('is one row of every action, in full, until it has been measured', () => {
    const { bar, visible } = open([500, 450, 400])
    expect(bar.hasAttribute('data-action-bar')).toBe(true)
    expect(bar.dataset.collapse).toBe('0')
    expect([...visible.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual([
      'Play again',
      'Watch replay',
      'Return to menu',
    ])
  })

  it('gives way in order: secondaries take their short label before it ever wraps', () => {
    const { bar, visible, resize } = open([500, 500, 400])
    resize(420)
    expect(bar.dataset.collapse).toBe('2')
    expect(visible.querySelector('[data-testid="play-again"]')?.textContent?.trim()).toBe('Play again')
    expect(visible.querySelector('[data-testid="watch-replay"]')?.textContent?.trim()).toBe('Replay')
    // The full words stay with assistive technology.
    expect(visible.querySelector('[data-testid="watch-replay"]')?.getAttribute('aria-label')).toBe(
      'Watch replay',
    )
  })

  it('wraps only as a last resort', () => {
    const { bar, resize } = open([500, 450, 400])
    resize(300)
    expect(bar.dataset.collapse).toBe('3')
  })

  it('drops a utility to its icon at level 1 and keeps its name', () => {
    const list: BarAction[] = [
      { id: 'go', label: 'Go', kind: 'primary', onSelect: vi.fn() },
      { id: 'mute', label: 'Mute', kind: 'utility', icon: textSnippet('🔇'), onSelect: vi.fn() },
    ]
    const { visible, resize } = open([300, 200, 200], list)
    resize(250)
    const mute = visible.querySelector('[data-testid="mute"]') as HTMLElement
    expect(mute.textContent?.trim()).toBe('🔇')
    expect(mute.getAttribute('aria-label')).toBe('Mute')
  })

  it('marks the primary action and says a toggle state', () => {
    const list: BarAction[] = [
      { id: 'go', label: 'Go', kind: 'primary', onSelect: vi.fn() },
      { id: 'full', label: 'Fullscreen', kind: 'utility', pressed: false, onSelect: vi.fn() },
      { id: 'later', label: 'Later', kind: 'secondary', disabled: true, onSelect: vi.fn() },
    ]
    const { visible } = open([300, 300, 300], list)
    expect(visible.querySelector('[data-testid="go"]')?.getAttribute('data-kind')).toBe('primary')
    expect(visible.querySelector('[data-testid="go"]')?.classList.contains('af-control--primary')).toBe(true)
    expect(visible.querySelector('[data-testid="full"]')?.getAttribute('aria-pressed')).toBe('false')
    expect(visible.querySelector('[data-testid="go"]')?.hasAttribute('aria-pressed')).toBe(false)
    expect((visible.querySelector('[data-testid="later"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('hands the click to the action, through the visible row only; the measuring rows are inert', () => {
    const onSelect = vi.fn()
    const { bar, visible } = open([500, 450, 400], actions(onSelect))
    ;(visible.querySelector('[data-testid="watch-replay"]') as HTMLButtonElement).click()
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0]?.[0]).toBeInstanceOf(MouseEvent)
    const box = bar.querySelector('[data-measures]') as HTMLElement
    expect(box.getAttribute('aria-hidden')).toBe('true')
    expect(box.hasAttribute('inert')).toBe(true)
    expect(box.querySelectorAll('[data-measure]')).toHaveLength(3)
    expect(box.querySelector('button, [data-testid]')).toBeNull()
  })
})
