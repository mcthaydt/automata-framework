import '../tokens.css'
import '../fonts.css'
import { type MountedFixture, mountFixture } from '@mcthaydt/automata-testing'
import { settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import WidgetGallery from '../testing/WidgetGallery.svelte'

// The widgets with production CSS in a real browser (kit spec §4.6, EDK.4 plan decision 4): every control has its
// hit area, the page never scrolls sideways, every kind of control shows its focus ring, and a dialog stays on a
// phone screen. Chromium only until EDK.6; WebKit and Firefox go through a test-request on the Orchestrator bus.
interface Size {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly presentation: 'popover' | 'sheet'
}

const SIZES: readonly Size[] = [
  { name: 'ipad-pro-11-landscape', width: 1194, height: 834, presentation: 'popover' },
  { name: 'ipad-pro-11-portrait', width: 834, height: 1194, presentation: 'sheet' },
  { name: 'phone-portrait', width: 390, height: 844, presentation: 'sheet' },
  { name: 'window-900x600', width: 900, height: 600, presentation: 'popover' },
]

const HIT = 44
const PRIMARY = 48

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

async function open(size: Size, props: Record<string, unknown> = {}): Promise<void> {
  await page.viewport(size.width, size.height)
  mounted = mountFixture(WidgetGallery, { presentation: size.presentation, ...props })
  await settleLayout()
}

const INTERACTIVE =
  'button, input, select, textarea, a[href], [role="slider"], [role="spinbutton"], [role="tab"], [role="radio"], [role="option"], [role="menuitem"], [tabindex]:not([tabindex="-1"])'

/** The controls a person can see: laid out, not hidden by `visibility`, not clipped to nothing. */
function visibleControls(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(INTERACTIVE)].filter((element) => {
    const box = element.getBoundingClientRect()
    return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
}

const describeControl = (element: HTMLElement): string =>
  `${element.tagName.toLowerCase()}${element.getAttribute('role') ? `[role=${element.getAttribute('role')}]` : ''} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 30)}"`

function tooSmall(controls: readonly HTMLElement[]): string[] {
  return controls.flatMap((element) => {
    const box = element.getBoundingClientRect()
    const needed = element.matches('[data-primary]') ? PRIMARY : HIT
    // A hair under 44 is a rounding artifact of a fractional layout, not a small target.
    return box.width < needed - 0.5 || box.height < needed - 0.5
      ? [`${describeControl(element)} is ${box.width.toFixed(1)} x ${box.height.toFixed(1)}, needs ${needed}`]
      : []
  })
}

describe.each(SIZES)('widgets at $name ($width x $height)', (size) => {
  test('every control has its hit area', async () => {
    await open(size)
    const controls = visibleControls()
    expect(controls.length).toBeGreaterThan(15)
    expect(tooSmall(controls)).toEqual([])
  })

  test('nothing makes the page scroll sideways', async () => {
    await open(size)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
    expect(document.body.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  })

  test('an open dialog stays inside the screen, and its primary action is 48 px', async () => {
    await open(size, { dialogOpen: true })
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    if (dialog === null) throw new Error('no dialog')
    const box = dialog.getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(size.width)
    expect(box.bottom).toBeLessThanOrEqual(size.height)
    expect(tooSmall(visibleControls(dialog))).toEqual([])
    const primary = dialog.querySelector<HTMLElement>('[data-primary]')
    expect(primary?.getBoundingClientRect().height).toBeGreaterThanOrEqual(PRIMARY - 0.5)
  })

  test('an open menu stays on screen with every item at its hit area', async () => {
    await open(size)
    await userEvent.click(page.getByRole('button', { name: 'Layer actions' }))
    await settleLayout()
    const menu = document.querySelector<HTMLElement>('[role="menu"]')
    if (menu === null) throw new Error('no menu')
    const surface = document.querySelector<HTMLElement>('[data-popup-root] > *') as HTMLElement
    const box = surface.getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(size.width)
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.bottom).toBeLessThanOrEqual(size.height)
    expect(tooSmall(visibleControls(menu))).toEqual([])
  })

  test('an open picker stays on screen with every option at its hit area', async () => {
    await open(size)
    await userEvent.click(page.getByRole('button', { name: /^Terrain/ }))
    await settleLayout()
    const surface = document.querySelector<HTMLElement>('[data-popup-root] > *') as HTMLElement
    const box = surface.getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(size.width)
    expect(box.bottom).toBeLessThanOrEqual(size.height)
    expect(tooSmall(visibleControls(surface))).toEqual([])
  })
})

/** Whether the focused element shows the kit's ring: an outline two pixels or wider. */
function hasRing(element: Element): boolean {
  const style = getComputedStyle(element)
  return Number.parseFloat(style.outlineWidth) >= 2 && style.outlineStyle !== 'none'
}

/** Presses Tab from the first control until focus comes back round (or leaves `within`), checking each stop. */
async function tabThrough(within?: HTMLElement): Promise<{ names: string[]; missing: string[] }> {
  const names: string[] = []
  const missing: string[] = []
  const seen = new Set<Element>()
  for (let step = 0; step < 80; step++) {
    await userEvent.tab()
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || active === document.body || seen.has(active)) break
    if (within && !within.contains(active)) break
    seen.add(active)
    names.push(describeControl(active))
    if (!hasRing(active)) missing.push(describeControl(active))
  }
  return { names, missing }
}

describe('focus ring', () => {
  test('every kind of control in the gallery shows a visible ring when reached by keyboard', async () => {
    await open(SIZES[0] as Size)
    document.body.focus()
    const { names, missing } = await tabThrough()
    expect(missing).toEqual([])
    // The walk really covered each widget, not just the first few stops.
    for (const expected of [
      'Decrease Width',
      'role=spinbutton',
      'role=slider',
      'role=radio',
      'Remove water',
      'Tint:',
      'role=tab',
      'Layer actions',
      'Terrain:',
      'Reorder Fog',
      'Undo',
    ]) {
      expect(
        names.some((name) => name.includes(expected)),
        `no stop at ${expected}`,
      ).toBe(true)
    }
  })

  test('the controls inside a dialog show it too', async () => {
    await open(SIZES[0] as Size, { dialogOpen: true })
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]') as HTMLElement
    const { names, missing } = await tabThrough(dialog)
    // Focus starts on Cancel, so the walk visits Delete layer and comes back round to Cancel.
    expect(names).toEqual(['button "Delete layer"', 'button "Cancel"'])
    expect(missing).toEqual([])
  })

  test('the items of an open menu and the field of an open picker show it too', async () => {
    await open(SIZES[0] as Size)
    ;(page.getByRole('button', { name: 'Layer actions' }).element() as HTMLElement).focus()
    await userEvent.keyboard('{Enter}')
    await settleLayout()
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem')
    expect(hasRing(document.activeElement as Element)).toBe(true)
    await userEvent.keyboard('{Escape}')
    ;(page.getByRole('button', { name: /^Terrain/ }).element() as HTMLElement).focus()
    await userEvent.keyboard('{Enter}')
    await settleLayout()
    expect(document.activeElement?.getAttribute('type')).toBe('search')
    expect(hasRing(document.activeElement as Element)).toBe(true)
  })

  test('the swatches of an open colour palette show it too', async () => {
    await open(SIZES[0] as Size)
    await userEvent.click(page.getByRole('button', { name: /^Tint:/ }))
    await settleLayout()
    const palette = document.querySelector<HTMLElement>(
      '[role="listbox"][aria-label="Tint palette"]',
    ) as HTMLElement
    const swatch = palette.querySelector<HTMLElement>('[role="option"]') as HTMLElement
    swatch.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(hasRing(document.activeElement as Element)).toBe(true)
  })
})
