// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet, tick } from 'svelte'
import { afterEach, describe, expect, test, vi } from 'vitest'
import ReorderList from '#src/shared/kit/widgets/ReorderList.svelte'
import ReorderFixture from '#src/testing/kit/ReorderFixture.svelte'

const layers = [
  { id: 'sky', label: 'Sky' },
  { id: 'fog', label: 'Fog' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'entities', label: 'Entities' },
]

const withLocked = [
  { id: 'sky', label: 'Sky' },
  { id: 'fog', label: 'Fog' },
  { id: 'tiles', label: 'Tiles', locked: true, reason: 'The tile layer is always third' },
  { id: 'entities', label: 'Entities' },
]

function mount(initial = layers) {
  const onreorder = vi.fn()
  const onblocked = vi.fn()
  render(ReorderFixture, { initial, onreorder, onblocked })
  return { onreorder, onblocked }
}

const handle = (name: string): HTMLElement => screen.getByRole('button', { name: `Reorder ${name}` })
// A row's content sits in its one `div`; the handle and the hidden reason are not part of what the row says.
const order = (): string[] =>
  screen.getAllByRole('listitem').map((row) => row.querySelector('div')?.textContent?.trim() ?? '')
const live = (): string =>
  screen
    .getAllByRole('status')
    .map((el) => el.textContent)
    .join('')

describe('ReorderList structure', () => {
  test('is a labelled list with a handle on every row and a live region', () => {
    mount()
    expect(screen.getByRole('list', { name: 'Layers' })).toBeInTheDocument()
    expect(order()).toEqual(['Sky', 'Fog', 'Tiles', 'Entities'])
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  test('draws a custom row from the item snippet', () => {
    const item = createRawSnippet<[{ label: string }, { dragging: boolean; lifted: boolean }]>((row) => ({
      render: () => `<span>custom ${row().label}</span>`,
    }))
    render(ReorderList, { label: 'Layers', items: layers, item })
    expect(screen.getByText('custom Fog')).toBeInTheDocument()
  })
})

describe('ReorderList with the keyboard', () => {
  test('Space lifts a row, arrows move it with announcements, Space drops it and reports once', async () => {
    const { onreorder } = mount()
    handle('Fog').focus()
    await userEvent.keyboard(' ')
    expect(handle('Fog')).toHaveAttribute('aria-pressed', 'true')
    expect(live()).toContain('Lifted Fog, place 2 of 4')
    await userEvent.keyboard('{ArrowDown}')
    expect(live()).toBe('Moved Fog to place 3 of 4')
    expect(onreorder).not.toHaveBeenCalled()
    await userEvent.keyboard(' ')
    expect(onreorder).toHaveBeenCalledTimes(1)
    expect(onreorder).toHaveBeenCalledWith({ id: 'fog', from: 1, to: 2 })
    expect(order()).toEqual(['Sky', 'Tiles', 'Fog', 'Entities'])
    expect(handle('Fog')).toHaveAttribute('aria-pressed', 'false')
    expect(live()).toBe('Dropped Fog at place 3 of 4')
  })

  test('the moved row keeps keyboard focus after the drop', async () => {
    mount()
    handle('Fog').focus()
    await userEvent.keyboard(' {ArrowDown} ')
    expect(handle('Fog')).toHaveFocus()
  })

  test('Enter drops too', async () => {
    const { onreorder } = mount()
    handle('Sky').focus()
    await userEvent.keyboard(' {ArrowDown}{Enter}')
    expect(onreorder).toHaveBeenCalledWith({ id: 'sky', from: 0, to: 1 })
  })

  test('several steps are still one report', async () => {
    const { onreorder } = mount()
    handle('Sky').focus()
    await userEvent.keyboard(' {ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp} ')
    expect(onreorder).toHaveBeenCalledTimes(1)
    expect(onreorder).toHaveBeenCalledWith({ id: 'sky', from: 0, to: 2 })
  })

  test('Escape cancels: nothing is reported and nothing moves', async () => {
    const { onreorder } = mount()
    handle('Fog').focus()
    await userEvent.keyboard(' {ArrowDown}{Escape}')
    expect(onreorder).not.toHaveBeenCalled()
    expect(order()).toEqual(['Sky', 'Fog', 'Tiles', 'Entities'])
    expect(handle('Fog')).toHaveAttribute('aria-pressed', 'false')
    expect(live()).toBe('Move cancelled. Fog stays at place 2 of 4')
  })

  test('dropping where it was reports nothing', async () => {
    const { onreorder } = mount()
    handle('Fog').focus()
    await userEvent.keyboard(' {ArrowDown}{ArrowUp} ')
    expect(onreorder).not.toHaveBeenCalled()
    expect(live()).toBe('Fog dropped where it was')
  })

  test('the ends stop a row, and say so', async () => {
    mount()
    handle('Sky').focus()
    await userEvent.keyboard(' {ArrowUp}')
    expect(live()).toBe('Sky cannot move further up')
    await userEvent.keyboard('{Escape}')
    handle('Entities').focus()
    await userEvent.keyboard(' {ArrowDown}')
    expect(live()).toBe('Entities cannot move further down')
  })

  test('arrows do nothing until a row is lifted', async () => {
    const { onreorder } = mount()
    handle('Fog').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onreorder).not.toHaveBeenCalled()
    expect(live()).toBe('')
  })

  test('leaving the handle cancels a lift', async () => {
    const { onreorder } = mount()
    handle('Fog').focus()
    await userEvent.keyboard(' {ArrowDown}')
    handle('Sky').focus()
    await tick()
    expect(handle('Fog')).toHaveAttribute('aria-pressed', 'false')
    expect(onreorder).not.toHaveBeenCalled()
  })

  test('Escape on a lifted row does not reach a dialog around it, but does when nothing is lifted', async () => {
    mount()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    handle('Fog').focus()
    await userEvent.keyboard(' {Escape}')
    expect(outer).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
    await userEvent.keyboard('{Escape}')
    expect(outer).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
    document.removeEventListener('keydown', outer)
  })
})

describe('ReorderList with a locked row', () => {
  test('says it is locked and cannot be lifted', async () => {
    const { onblocked, onreorder } = mount(withLocked)
    expect(handle('Tiles')).toHaveAttribute('aria-disabled', 'true')
    expect(handle('Tiles')).toHaveAccessibleDescription('The tile layer is always third')
    handle('Tiles').focus()
    await userEvent.keyboard(' ')
    expect(onblocked).toHaveBeenCalledWith('The tile layer is always third')
    expect(handle('Tiles')).toHaveAttribute('aria-pressed', 'false')
    expect(live()).toBe('Tiles is locked. The tile layer is always third')
    await userEvent.keyboard('{ArrowDown}')
    expect(onreorder).not.toHaveBeenCalled()
  })

  test('other rows step over it and it stays put', async () => {
    const { onreorder } = mount(withLocked)
    handle('Fog').focus()
    await userEvent.keyboard(' {ArrowDown}')
    expect(live()).toBe('Moved Fog to place 4 of 4')
    await userEvent.keyboard(' ')
    expect(onreorder).toHaveBeenCalledWith({ id: 'fog', from: 1, to: 3 })
    expect(order()).toEqual(['Sky', 'Entities', 'Tiles', 'Fog'])
  })
})

// -- pointer ------------------------------------------------------------------------------------------------------

const ROW = 44
const rect = (top: number, height: number): DOMRect =>
  ({
    top,
    bottom: top + height,
    left: 0,
    right: 300,
    width: 300,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect

function stubLayout(top = 0) {
  const rows = screen.getAllByRole('listitem')
  screen.getByRole('list').getBoundingClientRect = () => rect(top, ROW * rows.length)
  rows.forEach((row, index) => {
    row.getBoundingClientRect = () => rect(top + index * ROW, ROW)
  })
  return rows
}

const touch = (
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
  target: HTMLElement,
  y: number,
) => fireEvent[type](target, { pointerId: 7, pointerType: 'touch', clientX: 10, clientY: y, button: 0 })

describe('ReorderList with a pointer', () => {
  test('dragging a handle over another row moves it there, previews the shift, and reports once on release', async () => {
    const { onreorder } = mount()
    const rows = stubLayout()
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 100)
    await touch('pointerMove', handle('Fog'), 130)
    expect(rows[1]).toHaveAttribute('data-dragging')
    expect(rows[1]?.style.transform).toBe('translateY(64px)')
    // Tiles gives up its place to Fog; Sky and Entities stay.
    expect(rows[2]?.style.transform).toBe(`translateY(${-ROW}px)`)
    expect(rows[0]?.style.transform).toBe('')
    expect(onreorder).not.toHaveBeenCalled()
    await touch('pointerUp', handle('Fog'), 130)
    expect(onreorder).toHaveBeenCalledTimes(1)
    expect(onreorder).toHaveBeenCalledWith({ id: 'fog', from: 1, to: 2 })
    expect(order()).toEqual(['Sky', 'Tiles', 'Fog', 'Entities'])
    expect(rows[1]).not.toHaveAttribute('data-dragging')
    expect(live()).toBe('Dropped Fog at place 3 of 4')
  })

  test('a drag that ends over its own place reports nothing', async () => {
    const { onreorder } = mount()
    stubLayout()
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 130)
    await touch('pointerMove', handle('Fog'), 60)
    await touch('pointerUp', handle('Fog'), 60)
    expect(onreorder).not.toHaveBeenCalled()
  })

  test('a press that never leaves the slop is not a drag', async () => {
    const { onreorder } = mount()
    const rows = stubLayout()
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 69)
    expect(rows[1]).not.toHaveAttribute('data-dragging')
    await touch('pointerUp', handle('Fog'), 69)
    expect(onreorder).not.toHaveBeenCalled()
    expect(live()).toBe('')
  })

  test('a cancelled pointer drops nothing and puts the rows back', async () => {
    const { onreorder } = mount()
    const rows = stubLayout()
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 130)
    await touch('pointerCancel', handle('Fog'), 130)
    expect(onreorder).not.toHaveBeenCalled()
    expect(order()).toEqual(['Sky', 'Fog', 'Tiles', 'Entities'])
    expect(rows.map((row) => row.style.transform)).toEqual(['', '', '', ''])
    expect(rows[1]).not.toHaveAttribute('data-dragging')
  })

  test('Escape during a drag cancels it', async () => {
    const { onreorder } = mount()
    stubLayout()
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 130)
    await fireEvent.keyDown(handle('Fog'), { key: 'Escape' })
    await touch('pointerUp', handle('Fog'), 130)
    expect(onreorder).not.toHaveBeenCalled()
  })

  test('a drag past a locked row lands in the nearest unlocked place', async () => {
    const { onreorder } = mount(withLocked)
    stubLayout()
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 100)
    await touch('pointerMove', handle('Fog'), 110)
    await touch('pointerUp', handle('Fog'), 110)
    // Over Tiles (locked): the nearest place Fog can take is the one it left.
    expect(onreorder).not.toHaveBeenCalled()
  })

  test('a drag over the row beyond a locked one goes there, and the locked row stays', async () => {
    const { onreorder } = mount(withLocked)
    stubLayout()
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 100)
    await touch('pointerMove', handle('Fog'), 150)
    await touch('pointerUp', handle('Fog'), 150)
    expect(onreorder).toHaveBeenCalledWith({ id: 'fog', from: 1, to: 3 })
    expect(order()).toEqual(['Sky', 'Entities', 'Tiles', 'Fog'])
  })

  test('a locked row cannot be dragged and says why', async () => {
    const { onblocked, onreorder } = mount(withLocked)
    stubLayout()
    await touch('pointerDown', handle('Tiles'), 110)
    await touch('pointerMove', handle('Tiles'), 20)
    await touch('pointerUp', handle('Tiles'), 20)
    expect(onblocked).toHaveBeenCalledWith('The tile layer is always third')
    expect(onreorder).not.toHaveBeenCalled()
  })

  test('a plain click on a handle does nothing', async () => {
    const { onreorder } = mount()
    await userEvent.click(handle('Fog'))
    expect(handle('Fog')).toHaveAttribute('aria-pressed', 'false')
    expect(onreorder).not.toHaveBeenCalled()
  })
})

describe('ReorderList auto-scroll', () => {
  const frames: (() => void)[] = []

  afterEach(() => {
    vi.unstubAllGlobals()
    frames.length = 0
  })

  function stubFrames() {
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => frames.push(run))
    vi.stubGlobal('cancelAnimationFrame', () => {})
  }

  test('scrolls the nearest scrolling ancestor while the pointer is held near its edge', async () => {
    stubFrames()
    mount()
    stubLayout(0)
    const scroller =
      screen.getByRole('list').closest('[data-testid="scroller"]') ?? screen.getByRole('list').parentElement
    if (!(scroller instanceof HTMLElement)) throw new Error('no scroller')
    scroller.style.overflowY = 'auto'
    Object.defineProperty(scroller, 'scrollHeight', { value: 600, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 176, configurable: true })
    scroller.getBoundingClientRect = () => rect(0, 176)
    scroller.scrollTop = 100
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 170)
    const before = scroller.scrollTop
    frames.shift()?.()
    expect(scroller.scrollTop).toBeGreaterThan(before)
    await touch('pointerUp', handle('Fog'), 170)
  })

  test('does not scroll with the pointer in the middle', async () => {
    stubFrames()
    mount()
    stubLayout(0)
    const scroller = screen.getByRole('list').parentElement as HTMLElement
    scroller.style.overflowY = 'auto'
    Object.defineProperty(scroller, 'scrollHeight', { value: 600, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 400, configurable: true })
    scroller.getBoundingClientRect = () => rect(0, 400)
    scroller.scrollTop = 100
    await touch('pointerDown', handle('Fog'), 66)
    await touch('pointerMove', handle('Fog'), 120)
    frames.shift()?.()
    expect(scroller.scrollTop).toBe(100)
    await touch('pointerUp', handle('Fog'), 120)
  })
})
