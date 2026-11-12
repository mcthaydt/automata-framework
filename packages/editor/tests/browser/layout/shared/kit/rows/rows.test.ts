import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import RowsFixture from '#src/testing/kit/RowsFixture.svelte'

// The list and inspector parts with production CSS (spec 7.5): a row is 32 px with a mouse and 44 with touch, a field's
// control 28 and 44, a row's own buttons as big as a field's control and always there on touch, and a field has no box of
// its own: the only boxes are a control's edge and a block.
const touch = matchMedia('(any-pointer: coarse)').matches
const ROW = touch ? 44 : 32
const FIELD = touch ? 44 : 28

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

async function open(): Promise<void> {
  await page.viewport(1194, 834)
  mounted = mountFixture(RowsFixture, {})
  await settleLayout()
}

const all = (selector: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(selector)]

describe('rows, fields and blocks', () => {
  test('a row is the row height, its name never cut', async () => {
    await open()
    const rows = all('.row')
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      expect(rect.height, row.textContent ?? '').toBeGreaterThanOrEqual(ROW - 0.5)
      const name = row.querySelector<HTMLElement>('.name')
      expect(name?.scrollWidth).toBeLessThanOrEqual((name?.clientWidth ?? 0) + 1)
    }
  })

  test('the row buttons are a field control tall, and always shown on touch', async () => {
    await open()
    for (const button of all('.row .actions button')) {
      const rect = button.getBoundingClientRect()
      expect(rect.width, button.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(FIELD - 0.5)
      expect(rect.height).toBeGreaterThanOrEqual(FIELD - 0.5)
      if (touch) expect(getComputedStyle(button.closest('.actions') as HTMLElement).opacity).toBe('1')
    }
    if (!touch) {
      const first = all('.row .actions')[0] as HTMLElement
      expect(getComputedStyle(first).opacity).toBe('0')
      first.closest('.row')?.querySelector('button')?.focus()
      expect(getComputedStyle(first).opacity).toBe('1')
    }
  })

  test('a field control is the field height, the name 108 px to its left, and the field has no box of its own', async () => {
    await open()
    for (const field of all('.field[role="group"]')) {
      const control = field.querySelector<HTMLElement>('input') as HTMLElement
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(FIELD - 0.5)
      const name = field.querySelector<HTMLElement>('.l') as HTMLElement
      expect(Math.round(name.getBoundingClientRect().width)).toBe(108)
      expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(control.getBoundingClientRect().left)
    }
    for (const field of all('.field')) {
      const style = getComputedStyle(field)
      // The hairline between two fields of a block is the block's, not a box around either.
      expect(style.borderLeftWidth, 'a field has no sides').toBe('0px')
      expect(style.borderBottomWidth, 'a field has no foot').toBe('0px')
      if (field.closest('.block') === null) expect(style.borderTopWidth, 'a field has no border').toBe('0px')
      expect(style.backgroundColor, 'a field has no fill').toBe('rgba(0, 0, 0, 0)')
    }
  })

  test('a block has its 44 px head, and its fields are split by hairlines, not boxes', async () => {
    await open()
    const block = document.querySelector<HTMLElement>('.block') as HTMLElement
    expect(block.querySelector<HTMLElement>('.head')?.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      44,
    )
    const fields = [...block.querySelectorAll<HTMLElement>('.field')]
    expect(fields).toHaveLength(2)
    expect(getComputedStyle(fields[1] as HTMLElement).borderTopWidth).toBe('1px')
  })

  test('nothing is wider than the inspector', async () => {
    await open()
    const inspector = document.querySelector<HTMLElement>('.inspector') as HTMLElement
    expect(inspector.scrollWidth).toBeLessThanOrEqual(inspector.clientWidth + 1)
  })
})
