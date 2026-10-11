import { textSnippet } from '@mcthaydt/automata-testing'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import ScrollList from './ScrollList.svelte'

// Ported from FloorFifty tests/client/ui/layout/scroll-list.test.ts at 122a220.
let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

const rows = (count: number) =>
  textSnippet(Array.from({ length: count }, (_, i) => `<li data-row>Row ${i + 1}</li>`).join(''), 'ol', true)

function open(minRows: number, rowCount: number, rowGap?: string) {
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(ScrollList, {
    target: host,
    props: {
      minRows,
      rowCount,
      label: 'Standings',
      moreLabel: (n: number) => `+${n} more`,
      testId: 'standings',
      children: rows(rowCount),
      ...(rowGap === undefined ? {} : { rowGap }),
    },
  })
  flushSync()
  return host.querySelector<HTMLElement>('[data-testid="standings"]') as HTMLElement
}

describe('ScrollList', () => {
  it('declares itself a named scroll region with its minimum, for the layout contract', () => {
    const list = open(4, 6)
    expect(list.hasAttribute('data-scroll-region')).toBe(true)
    expect(list.dataset.minRows).toBe('4')
    expect(list.getAttribute('role')).toBe('region')
    expect(list.getAttribute('aria-label')).toBe('Standings')
  })

  it('reserves its rows in the row-height token, or every row when there are fewer', () => {
    expect(open(4, 6).style.minHeight).toBe('calc(4 * var(--af-row-h))')
    document.body.innerHTML = ''
    expect(open(4, 2).style.minHeight).toBe('calc(2 * var(--af-row-h))')
  })

  it('reserves the gaps between its rows too, when told them', () => {
    expect(open(4, 6, '8px').style.minHeight).toBe('calc(4 * var(--af-row-h) + 3 * 8px)')
  })

  it('reserves at least where its last reserved row actually ends, once rows have a height', () => {
    const list = open(2, 4)
    const heights = [70, 40, 40, 40]
    list.querySelectorAll<HTMLElement>('[data-row]').forEach((row, index) => {
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: heights[index] })
    })
    list.dispatchEvent(new Event('scroll'))
    flushSync()
    expect(list.style.minHeight).toBe('max(calc(2 * var(--af-row-h)), 110px)')
  })

  it('says how many rows are out of view, and nothing when none are', () => {
    const list = open(2, 5)
    expect(list.querySelector('[data-testid="scroll-more"]')).toBeNull()
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 120 })
    for (const row of list.querySelectorAll<HTMLElement>('[data-row]'))
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: 40 })
    list.dispatchEvent(new Event('scroll'))
    flushSync()
    const more = list.querySelector('[data-testid="scroll-more"]')
    expect(more?.textContent).toBe('+2 more')
    expect(more?.getAttribute('aria-hidden')).toBe('true')
    expect(list.dataset.more).toBe('true')
  })
})
