import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import {
  byTestId,
  checkLayout,
  type MountedFixture,
  mountFixture,
  publishConditions,
  type ReferenceSize,
  settleLayout,
  VARIANTS,
  type Variant,
} from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import type { ShellMode } from '#src/shared/kit/shell/shell-mode.ts'
import ShellFixture from '#src/testing/kit/ShellFixture.svelte'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The shell with production CSS in a real browser, at the window sizes the 2D editor is designed for
//. `inert` and `visibility` are only real here; jsdom keeps neither.
interface EditorSize extends ReferenceSize {
  readonly mode: ShellMode
}

const at = (
  name: string,
  width: number,
  height: number,
  mode: ShellMode,
  formFactor: ReferenceSize['formFactor'],
  heightTier: ReferenceSize['heightTier'] = undefined,
): EditorSize => ({ name, width, height, mode, formFactor, heightTier, group: 'tablet' })

const SIZES: readonly EditorSize[] = [
  at('ipad-pro-11-landscape', 1194, 834, 'wide', 'desktop'),
  at('ipad-pro-13-landscape', 1366, 1024, 'wide', 'desktop'),
  at('ipad-mini-landscape', 1133, 744, 'medium', 'desktop'),
  at('window-900x600', 900, 600, 'medium', 'desktop', 'short'),
  at('ipad-pro-11-portrait', 834, 1194, 'medium', 'tablet-portrait'),
  at('ipad-mini-portrait', 744, 1133, 'compact', 'tablet-portrait'),
  at('phone-portrait', 390, 844, 'compact', 'phone-portrait'),
  at('phone-landscape', 844, 390, 'compact', 'phone-landscape', 'short'),
]

const variantNamed = (name: Variant['name']): Variant => {
  const found = VARIANTS.find((variant) => variant.name === name)
  if (found === undefined) throw new Error(`no ${name} variant`)
  return found
}
const REST = variantNamed('rest')
const KEYBOARD = variantNamed('keyboard')

const region = (name: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
const rect = (name: string): DOMRect => region(name).getBoundingClientRect()

/** The controls a player must reach without scrolling: the top bar and the rail. */
const CHROME = [
  'toggle-panel',
  'toggle-inspector',
  'toggle-dock',
  'rail-Stage',
  'rail-Path',
  'rail-Parts',
  'rail-Checks',
  'rail-Export',
]
/** With nothing open the canvas is all there is, so its field must be reachable too. */
const CANVAS = ['canvas-field']

// A failed check must not leave its shell mounted for the next size to find first.
let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

describe.each(SIZES)('shell layout at $name ($width x $height)', (size) => {
  test.each([
    ['rest', REST, {}],
    ['keyboard', KEYBOARD, {}],
    ['every region opened', REST, { panelOpen: true, inspectorOpen: true, dockOpen: true }],
  ] as const)('%s: no clipped, overlapping, small or unreachable controls', async (_name, variant, props) => {
    await page.viewport(size.width, size.height)
    const conditions = publishConditions(document.documentElement, size, variant, targets)
    mounted = mountFixture(ShellFixture, { geometry: { current: conditions.geometry }, ...props })
    await settleLayout()
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', size.mode)
    // With the keyboard up the shell ends above it and `checkLayout` checks nothing sits under it; reaching
    // a control may then take a scroll, so none is required to be in view. An open inspector or sheet covers the canvas.
    const nothingOpen = Object.keys(props).length === 0
    const essentials = variant.keyboard === undefined ? [...CHROME, ...(nothingOpen ? CANVAS : [])] : []
    expect(checkLayout(conditions, essentials.map(byTestId))).toEqual([])
  })
})

const near = (actual: number, expected: number, slack = 1): void => {
  expect(Math.abs(actual - expected), `${actual} is not within ${slack} of ${expected}`).toBeLessThanOrEqual(
    slack,
  )
}

/** Publishes `size` the way the geometry owner would and mounts the fixture; the afterEach unmounts it. */
async function open(size: EditorSize, props: Record<string, unknown> = {}, variant = REST) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, variant, targets)
  mounted = mountFixture(ShellFixture, { geometry: { current: conditions.geometry }, ...props })
  await settleLayout()
  return conditions
}

const size = (name: string): EditorSize => {
  const found = SIZES.find((candidate) => candidate.name === name)
  if (found === undefined) throw new Error(`no size ${name}`)
  return found
}

const INSET = 8

describe('wide: sidebar, then an inset work panel of list, canvas, inspector, dock beneath, status at the foot', () => {
  test("the regions have the mockup's sizes and tile the work panel", async () => {
    await open(size('ipad-pro-11-landscape'))
    const [topbar, railBox, panel, canvas, inspector, dock, status] = [
      'topbar',
      'rail',
      'panel',
      'canvas',
      'inspector',
      'dock',
      'status',
    ].map(rect) as [DOMRect, DOMRect, DOMRect, DOMRect, DOMRect, DOMRect, DOMRect]
    expect(topbar.height).toBeGreaterThanOrEqual(48)
    near(topbar.width, 1194 - 224 - INSET)
    near(topbar.top, INSET)
    near(railBox.width, 224)
    near(railBox.height, 834)
    near(panel.width, 264)
    near(inspector.width, 320)
    near(dock.height, 148)
    near(panel.left, railBox.right)
    near(canvas.left, panel.right)
    near(canvas.right, inspector.left)
    near(inspector.right, 1194 - INSET)
    near(canvas.top, topbar.bottom)
    near(dock.top, canvas.bottom)
    near(dock.left, canvas.left)
    near(dock.width, canvas.width)
    near(status.bottom, 834 - INSET)
    near(dock.bottom, status.top)
  })

  test('the panel has a face: 8 px corners, a 1 px edge, inset 8 px from the top, right and bottom', async () => {
    await open(size('ipad-pro-11-landscape'))
    const frame = document.querySelector<HTMLElement>('[data-frame]') as HTMLElement
    const box = frame.getBoundingClientRect()
    const style = getComputedStyle(frame)
    near(box.left, 224)
    near(box.top, INSET)
    near(box.right, 1194 - INSET)
    near(box.bottom, 834 - INSET)
    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderTopLeftRadius).toBe('8px')
    expect(getComputedStyle(region('rail')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  test('nothing is wider than the window', async () => {
    await open(size('ipad-pro-13-landscape'))
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  test('a 1280 x 560 window keeps the dock closed behind its handle and gives the canvas the room', async () => {
    await open(at('window-1280x560', 1280, 560, 'wide', 'desktop', 'short'))
    expect(region('dock')).toHaveAttribute('data-presentation', 'sheet')
    expect(getComputedStyle(region('dock')).visibility).toBe('hidden')
    near(rect('canvas').bottom, rect('status').top)
  })
})

describe('a screen with no panel gives its column to the canvas', () => {
  test('wide: the canvas starts where the sidebar ends', async () => {
    await open(size('ipad-pro-11-landscape'), { panel: false })
    near(rect('canvas').left, rect('rail').right)
    expect(document.querySelector('[data-region="panel"]')).toBeNull()
  })
})

describe('a screen with no inspector gives its column to the canvas', () => {
  test('wide: the canvas runs to the right edge', async () => {
    await open(size('ipad-pro-11-landscape'), { inspector: false })
    near(rect('canvas').left, rect('panel').right)
    near(rect('canvas').right, 1194 - INSET)
    expect(document.querySelector('[data-region="inspector"]')).toBeNull()
  })
})

describe('a screen with no rail gives its column and its tab bar to the canvas', () => {
  test('wide: the panel starts at the edge and the regions still tile the window', async () => {
    await open(size('ipad-pro-11-landscape'), { rail: false })
    near(rect('panel').left, 0)
    near(rect('panel').width, 264)
    near(rect('canvas').left, rect('panel').right)
    near(rect('canvas').right, rect('inspector').left)
    near(rect('inspector').width, 320)
    near(rect('inspector').right, 1194 - INSET)
    near(rect('status').bottom, 834 - INSET)
    near(rect('dock').bottom, rect('status').top)
  })

  test.each([
    ['ipad-pro-11-portrait', 834 - 264 - INSET, 1194 - INSET],
    ['phone-portrait', 390, 844],
    ['phone-landscape', 844, 390],
  ])('%s: the status line is the foot of the panel', async (name, width, height) => {
    await open(size(name), { rail: false })
    near(rect('canvas').width, width)
    near(rect('status').bottom, height)
    near(rect('canvas').bottom, rect('status').top)
    near(rect('canvas').top, rect('topbar').bottom)
  })
})

describe('the status line fills the status region', () => {
  test.each([['ipad-pro-11-landscape'], ['ipad-pro-11-portrait']])(
    '%s: edge to edge, with the region’s border and not a second one',
    async (name) => {
      const { width: whole, mode } = size(name)
      const width = mode === 'compact' ? whole : whole - INSET
      await open(size(name), { rail: false, statusLine: true })
      const line = document.querySelector<HTMLElement>('[data-widget="status-line"]') as HTMLElement
      near(line.getBoundingClientRect().left, 0)
      near(line.getBoundingClientRect().width, width)
      near(line.getBoundingClientRect().height, rect('status').height - 1)
      expect(getComputedStyle(line).borderTopWidth).toBe('0px')
      expect(getComputedStyle(region('status')).borderTopWidth).toBe('1px')
    },
  )
})

describe('the status line is the panel’s foot', () => {
  test('it is set in Geist Mono at 12 px, in the faint colour', async () => {
    await open(size('ipad-pro-11-landscape'), { rail: false, statusLine: true })
    const style = getComputedStyle(document.querySelector('[data-widget="status-line"]') as HTMLElement)
    expect(style.fontSize).toBe('12px')
    expect(style.fontFamily).toContain('Geist Mono')
    const probe = document.body.appendChild(document.createElement('i'))
    probe.style.color = 'var(--tool-faint)'
    expect(style.color).toBe(getComputedStyle(probe).color)
    probe.remove()
  })

  test('on a phone it is hidden: nothing there is needed to act, and the tab bar keeps the foot', async () => {
    await open(size('phone-portrait'), { rail: false, statusLine: true })
    expect(getComputedStyle(region('status')).display).toBe('none')
  })
})

describe('a toast in the sheets clears the foot (the tab bar and the status line)', () => {
  test.each(SIZES.map((each) => [each.name, each] as const))('%s', async (_name, each) => {
    await open(each, { toast: 'Locked values were cleared when the page reloaded.' })
    await expect.poll(() => document.querySelector('[data-widget="toast-region"] .toast')).not.toBeNull()
    await settleLayout()
    const toast = document
      .querySelector<HTMLElement>('[data-widget="toast-region"] .toast')
      ?.getBoundingClientRect()
    // Only the compact tab bar lies along the foot; the sidebar, the rail and the standing bar are columns.
    const lying = each.mode === 'compact' && each.name !== 'phone-landscape'
    const foot = Math.min(rect('status').top, lying ? rect('rail').top : Number.POSITIVE_INFINITY)
    expect(toast?.bottom).toBeLessThanOrEqual(foot + 0.5)
  })
})

describe('a screen with no dock does not leave room for one', () => {
  test('medium: the open inspector keeps to the foot of the canvas, not above where a dock sheet would begin', async () => {
    await open(size('ipad-pro-11-portrait'), { rail: false, dock: false, inspectorOpen: true })
    near(rect('inspector').bottom, rect('canvas').bottom - 12)
  })
})

describe('medium: a 76 px rail, then the list beside the canvas on the inset panel, the inspector floating over it', () => {
  test('ipad-pro-11-portrait', async () => {
    await open(size('ipad-pro-11-portrait'))
    near(rect('rail').left, 0)
    near(rect('rail').width, 76)
    near(rect('rail').height, 1194)
    near(rect('panel').left, rect('rail').right)
    near(rect('panel').width, 264)
    near(rect('canvas').left, rect('panel').right)
    near(rect('canvas').right, 834 - INSET)
    near(rect('panel').top, rect('topbar').bottom)
    near(rect('panel').bottom, rect('canvas').bottom)
    near(rect('canvas').bottom, rect('status').top)
    near(rect('status').bottom, 1194 - INSET)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  test('the closed inspector is out of sight, inert and still laid out', async () => {
    await open(size('ipad-pro-11-portrait'))
    expect(region('inspector')).toHaveAttribute('inert')
    expect(getComputedStyle(region('inspector')).visibility).toBe('hidden')
    expect(rect('inspector').height).toBeGreaterThan(0)
  })

  test('the open inspector is a live card over the canvas’s lower right, as wide as the wide inspector', async () => {
    await open(size('ipad-pro-11-portrait'), { rail: false, dock: false, inspectorOpen: true })
    expect(region('inspector')).not.toHaveAttribute('inert')
    expect(getComputedStyle(region('inspector')).visibility).toBe('visible')
    near(rect('inspector').width, 320)
    near(rect('inspector').right, rect('canvas').right - 12)
    // Clear of the row a stage pill floats in: 12 px margins either side of a target, its padding and its edges.
    expect(rect('inspector').top).toBeGreaterThanOrEqual(rect('canvas').top + 24 + targets.hit + 8 + 2 - 1)
  })

  test('the inspector sits above an open dock sheet instead of under it', async () => {
    await open(size('ipad-pro-11-portrait'), { inspectorOpen: true, dockOpen: true })
    const dock = rect('dock')
    expect(rect('inspector').bottom).toBeLessThanOrEqual(dock.top + 1)
    near(dock.bottom, rect('canvas').bottom)
  })
})

describe('compact: the panel fills the window, the tab bar lies along the foot or stands at the left', () => {
  test('phone-portrait', async () => {
    await open(size('phone-portrait'))
    near(rect('canvas').width, 390)
    near(rect('canvas').left, 0)
    near(rect('rail').height, 56)
    near(rect('rail').bottom, 844)
    near(rect('rail').width, 390)
    expect(rect('topbar').height).toBeGreaterThanOrEqual(48)
    near(rect('canvas').top, rect('topbar').bottom)
    near(rect('canvas').bottom, rect('status').top)
    near(rect('status').bottom, rect('rail').top)
    const frame = document.querySelector<HTMLElement>('[data-frame]') as HTMLElement
    near(frame.getBoundingClientRect().width, 390)
    expect(getComputedStyle(frame).borderTopLeftRadius).toBe('0px')
  })

  test('phone-landscape: the bar stands at the left, 72 px wide, and the work keeps its height', async () => {
    await open(size('phone-landscape'))
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-standing')
    near(rect('rail').left, 0)
    near(rect('rail').width, 72)
    near(rect('rail').height, 390)
    near(rect('canvas').left, 72)
    near(rect('canvas').right, 844)
    near(rect('status').bottom, 390)
    near(rect('topbar').left, 72)
  })
})

describe('sheets and their detents', () => {
  const sheetHeight = (name: string): number => rect(name).height

  test('a sheet sits at the foot of the canvas and its handle is a 44 px target', async () => {
    await open(size('phone-portrait'), { panelOpen: true })
    near(rect('panel').bottom, rect('canvas').bottom)
    const handle = region('panel').querySelector<HTMLElement>('[data-sheet-handle]') as HTMLElement
    expect(handle.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
    expect(handle.getBoundingClientRect().width).toBeGreaterThanOrEqual(targets.hit)
  })

  test('peek is the strip, half 50% and full 92% of the room above the status line', async () => {
    await open(size('phone-portrait'), { panelOpen: true })
    const room = rect('canvas').height
    const handle = region('panel').querySelector<HTMLElement>('[data-sheet-handle]') as HTMLElement
    near(sheetHeight('panel'), room * 0.5)
    handle.click()
    await settleLayout()
    near(sheetHeight('panel'), room * 0.92)
    handle.click()
    await settleLayout()
    near(sheetHeight('panel'), 96)
  })

  test('the dock sheet at peek is its own 148 px, the handle and nothing more', async () => {
    await open(size('ipad-pro-11-portrait'))
    near(sheetHeight('dock'), 148 + 44)
  })

  // macOS draws an overlay scroll bar over a scrolling region's end edge once it scrolls, and WebKit there hit-tests it
  // (about 15 px), so a control laid out to the body's padding edge loses its right-hand taps (#265: Mac WebKit,
  // 844 x 390). Linux browsers lay overlay bars out of the hit test, so the rule is held here as a measure.
  test("every scrolling body keeps its controls clear of an overlay scroll bar's 15 px", async () => {
    await open(size('phone-landscape'), { panelOpen: true })
    for (const name of ['panel', 'inspector', 'dock']) {
      const body = region(name).querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
      expect(Number.parseFloat(getComputedStyle(body).paddingInlineEnd), name).toBeGreaterThanOrEqual(16)
    }
  })

  test('a sheet never takes more than the room there is (a sideways phone)', async () => {
    await open(size('phone-landscape'), { dockOpen: true })
    expect(sheetHeight('dock')).toBeLessThanOrEqual(rect('canvas').height + 1)
  })
})

describe('the canvas', () => {
  test('takes every gesture itself and does not scroll the page', async () => {
    await open(size('ipad-pro-11-portrait'))
    const style = getComputedStyle(region('canvas'))
    expect(style.touchAction).toBe('none')
    expect(style.overscrollBehaviorX).toBe('none')
    expect(style.overscrollBehaviorY).toBe('none')
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
  })
})

describe('when the window turns or the keyboard comes up', () => {
  test('rotating keeps the canvas element, the focus and the text in its field', async () => {
    const landscape = size('ipad-pro-11-landscape')
    const portrait = size('ipad-pro-11-portrait')
    await page.viewport(landscape.width, landscape.height)
    publishConditions(document.documentElement, landscape, REST, targets)
    const geometry = stubGeometry(landscape.width, landscape.height)
    mounted = mountFixture(ShellFixture, { geometry })
    await settleLayout()
    const canvas = region('canvas')
    const field = byTestId('canvas-field') as HTMLInputElement
    field.focus()
    field.value = 'Rooftops'
    expect(document.activeElement).toBe(field)

    await page.viewport(portrait.width, portrait.height)
    publishConditions(document.documentElement, portrait, REST, targets)
    geometry.resize(portrait.width, portrait.height)
    await settleLayout()

    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', 'medium')
    expect(region('canvas')).toBe(canvas)
    expect(byTestId('canvas-field')).toBe(field)
    expect(document.activeElement).toBe(field)
    expect(field.value).toBe('Rooftops')
    near(rect('canvas').width, portrait.width - 76 - 264 - INSET)
  })

  test('the panel keeps its scroll position when it turns into a closed sheet and back', async () => {
    const landscape = size('ipad-pro-11-landscape')
    const portrait = size('phone-portrait')
    await page.viewport(landscape.width, landscape.height)
    publishConditions(document.documentElement, landscape, REST, targets)
    const geometry = stubGeometry(landscape.width, landscape.height)
    mounted = mountFixture(ShellFixture, { geometry })
    await settleLayout()
    const body = region('panel').querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
    expect(
      body.scrollHeight,
      'the fixture must overflow the panel for this to prove anything',
    ).toBeGreaterThan(body.clientHeight + 100)
    body.scrollTop = 100
    expect(body.scrollTop).toBe(100)

    await page.viewport(portrait.width, portrait.height)
    publishConditions(document.documentElement, portrait, REST, targets)
    geometry.resize(portrait.width, portrait.height)
    await settleLayout()
    expect(region('panel').querySelector('[data-scroll-region]')).toBe(body)
    expect(body.scrollTop).toBe(100)

    await page.viewport(landscape.width, landscape.height)
    publishConditions(document.documentElement, landscape, REST, targets)
    geometry.resize(landscape.width, landscape.height)
    await settleLayout()
    expect(body.scrollTop).toBe(100)
  })

  test('the keyboard shrinks the shell above it without moving focus off the canvas field', async () => {
    const tablet = size('ipad-pro-11-portrait')
    await page.viewport(tablet.width, tablet.height)
    publishConditions(document.documentElement, tablet, REST, targets)
    const geometry = stubGeometry(tablet.width, tablet.height)
    mounted = mountFixture(ShellFixture, { geometry })
    await settleLayout()
    const canvas = region('canvas')
    const field = byTestId('canvas-field') as HTMLInputElement
    field.focus()

    const conditions = publishConditions(document.documentElement, tablet, KEYBOARD, targets)
    await settleLayout()

    const keyboardTop = tablet.height - (KEYBOARD.keyboard?.(tablet) ?? 0)
    expect(conditions.reserved).toHaveLength(1)
    expect(rect('rail').bottom).toBeLessThanOrEqual(keyboardTop + 1)
    expect(region('canvas')).toBe(canvas)
    expect(document.activeElement).toBe(field)
    expect(rect('canvas').height).toBeGreaterThan(0)
  })
})

describe('a broken region shows its error panel inside its own box (kit spec §6)', () => {
  const copyButton = (name: string): HTMLElement => {
    const found = region(name).querySelector<HTMLElement>('[data-region-error] button')
    if (found === null) throw new Error(`no Copy details in the ${name} region`)
    return found
  }

  test.each([
    ['ipad-pro-11-landscape', 'topbar', {}],
    ['ipad-pro-11-landscape', 'rail', {}],
    ['ipad-pro-11-landscape', 'panel', {}],
    ['ipad-pro-11-landscape', 'canvas', {}],
    ['ipad-pro-11-landscape', 'inspector', {}],
    ['ipad-pro-11-landscape', 'dock', {}],
    ['ipad-pro-11-landscape', 'status', {}],
    ['ipad-pro-11-portrait', 'rail', {}],
    ['ipad-pro-11-portrait', 'inspector', { inspectorOpen: true }],
    ['phone-portrait', 'topbar', {}],
    ['phone-portrait', 'status', {}],
    ['phone-portrait', 'panel', { panelOpen: true }],
    ['phone-portrait', 'rail', {}],
    ['phone-portrait', 'canvas', {}],
    ['phone-portrait', 'inspector', { inspectorOpen: true }],
    ['phone-landscape', 'rail', {}],
    ['phone-landscape', 'canvas', {}],
    ['phone-landscape', 'inspector', { inspectorOpen: true }],
    ['phone-landscape', 'dock', { dockOpen: true }],
  ] as const)(
    '%s, %s: Copy details is a 44 px target inside the region, and the layout holds',
    async (name, broken, props) => {
      const conditions = await open(size(name), { broken, ...props })
      const button = copyButton(broken).getBoundingClientRect()
      const box = rect(broken)
      expect(button.width).toBeGreaterThanOrEqual(targets.hit)
      expect(button.height).toBeGreaterThanOrEqual(targets.hit)
      expect(button.left).toBeGreaterThanOrEqual(box.left - 0.5)
      expect(button.right).toBeLessThanOrEqual(box.right + 0.5)
      expect(button.top).toBeGreaterThanOrEqual(box.top - 0.5)
      expect(button.bottom).toBeLessThanOrEqual(box.bottom + 0.5)
      // The chrome the broken region held is gone with its content; the rest must still be reachable.
      const chrome = CHROME.filter((id) => document.querySelector(`[data-testid="${id}"]`) !== null)
      expect(checkLayout(conditions, [...chrome.map(byTestId), copyButton(broken)])).toEqual([])
    },
  )
})
