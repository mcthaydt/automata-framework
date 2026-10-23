import '../tokens.css'
import '../fonts.css'
import {
  type MountedFixture,
  mountFixture,
  type ReferenceSize,
  VARIANTS,
  type Variant,
} from '@mcthaydt/automata-testing'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import ShellFixture from '../testing/ShellFixture.svelte'
import { stubGeometry } from '../testing/stub-geometry.svelte'
import type { ShellMode } from './shell-mode'

// The shell with production CSS in a real browser, at the window sizes the 2D editor is designed for
// (kit spec §7). `inert` and `visibility` are only real here; jsdom keeps neither.
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
  at('ipad-mini-landscape', 1133, 744, 'wide', 'desktop'),
  at('window-900x600', 900, 600, 'wide', 'desktop', 'short'),
  at('ipad-pro-11-portrait', 834, 1194, 'medium', 'tablet-portrait'),
  at('ipad-mini-portrait', 744, 1133, 'medium', 'tablet-portrait'),
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
    const conditions = publishConditions(document.documentElement, size, variant)
    mounted = mountFixture(ShellFixture, { geometry: { current: conditions.geometry }, ...props })
    await settleLayout()
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', size.mode)
    // With the keyboard up the shell ends above it and `checkLayout` checks nothing sits under it; reaching
    // a control may then take a scroll, so none is required to be in view. Open drawers cover the canvas.
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
  const conditions = publishConditions(document.documentElement, size, variant)
  mounted = mountFixture(ShellFixture, { geometry: { current: conditions.geometry }, ...props })
  await settleLayout()
  return conditions
}

const size = (name: string): EditorSize => {
  const found = SIZES.find((candidate) => candidate.name === name)
  if (found === undefined) throw new Error(`no size ${name}`)
  return found
}

describe('wide: rail, panel, canvas, inspector, dock beneath, status at the foot', () => {
  test("the regions have the mockups' sizes and tile the window", async () => {
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
    near(topbar.height, 52)
    near(topbar.width, 1194)
    near(railBox.width, 56)
    near(panel.width, 264)
    near(inspector.width, 320)
    near(dock.height, 148)
    near(panel.left, railBox.right)
    near(canvas.left, panel.right)
    near(canvas.right, inspector.left)
    near(inspector.right, 1194)
    near(canvas.top, topbar.bottom)
    near(dock.top, canvas.bottom)
    near(dock.left, canvas.left)
    near(dock.width, canvas.width)
    near(status.bottom, 834)
    near(dock.bottom, status.top)
  })

  test('a 900 x 600 window keeps the dock closed behind its handle and gives the canvas the room', async () => {
    await open(size('window-900x600'))
    expect(region('dock')).toHaveAttribute('data-presentation', 'sheet')
    expect(getComputedStyle(region('dock')).visibility).toBe('hidden')
    near(rect('canvas').bottom, rect('status').top)
  })

  test('an iPad mini in landscape (1133 x 744) keeps the dock inline', async () => {
    await open(size('ipad-mini-landscape'))
    expect(region('dock')).toHaveAttribute('data-presentation', 'inline')
    near(rect('dock').height, 148)
  })
})

describe('medium and compact: the canvas takes the width, the rail is a tab bar', () => {
  test.each([
    ['ipad-pro-11-portrait', 834, 1194],
    ['phone-portrait', 390, 844],
    ['phone-landscape', 844, 390],
  ])('%s', async (name, width, height) => {
    await open(size(name))
    near(rect('canvas').width, width)
    near(rect('canvas').left, 0)
    near(rect('rail').height, 64)
    near(rect('rail').bottom, height)
    near(rect('rail').width, width)
    near(rect('topbar').height, 52)
    near(rect('canvas').top, rect('topbar').bottom)
    near(rect('canvas').bottom, rect('status').top)
    near(rect('status').bottom, rect('rail').top)
  })

  test('the drawers of medium are out of sight, inert and still laid out while closed', async () => {
    await open(size('ipad-pro-11-portrait'))
    for (const name of ['panel', 'inspector']) {
      expect(region(name)).toHaveAttribute('inert')
      expect(getComputedStyle(region(name)).visibility).toBe('hidden')
      expect(rect(name).height).toBeGreaterThan(0)
    }
  })

  test('an open drawer is live, as wide as the mockup, and sits against its edge', async () => {
    await open(size('ipad-pro-11-portrait'), { panelOpen: true, inspectorOpen: true })
    expect(region('panel')).not.toHaveAttribute('inert')
    expect(getComputedStyle(region('panel')).visibility).toBe('visible')
    near(rect('panel').width, 320)
    near(rect('panel').left, 0)
    near(rect('inspector').width, 320)
    near(rect('inspector').right, 834)
  })

  test('drawers end above an open dock sheet instead of running under it', async () => {
    await open(size('ipad-pro-11-portrait'), { panelOpen: true, inspectorOpen: true, dockOpen: true })
    const dock = rect('dock')
    expect(rect('panel').bottom).toBeLessThanOrEqual(dock.top + 1)
    expect(rect('inspector').bottom).toBeLessThanOrEqual(dock.top + 1)
    near(dock.bottom, rect('canvas').bottom)
  })
})

describe('sheets and their detents', () => {
  const sheetHeight = (name: string): number => rect(name).height

  test('a sheet sits at the foot of the canvas and its handle is a 44 px target', async () => {
    await open(size('phone-portrait'), { panelOpen: true })
    near(rect('panel').bottom, rect('canvas').bottom)
    const handle = region('panel').querySelector<HTMLElement>('[data-sheet-handle]') as HTMLElement
    expect(handle.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(handle.getBoundingClientRect().width).toBeGreaterThanOrEqual(44)
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
    publishConditions(document.documentElement, landscape, REST)
    const geometry = stubGeometry(landscape.width, landscape.height)
    mounted = mountFixture(ShellFixture, { geometry })
    await settleLayout()
    const canvas = region('canvas')
    const field = byTestId('canvas-field') as HTMLInputElement
    field.focus()
    field.value = 'Rooftops'
    expect(document.activeElement).toBe(field)

    await page.viewport(portrait.width, portrait.height)
    publishConditions(document.documentElement, portrait, REST)
    geometry.resize(portrait.width, portrait.height)
    await settleLayout()

    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', 'medium')
    expect(region('canvas')).toBe(canvas)
    expect(byTestId('canvas-field')).toBe(field)
    expect(document.activeElement).toBe(field)
    expect(field.value).toBe('Rooftops')
    near(rect('canvas').width, portrait.width)
  })

  test('the panel keeps its scroll position when it turns into a closed drawer and back', async () => {
    const landscape = size('ipad-pro-11-landscape')
    const portrait = size('ipad-pro-11-portrait')
    await page.viewport(landscape.width, landscape.height)
    publishConditions(document.documentElement, landscape, REST)
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
    publishConditions(document.documentElement, portrait, REST)
    geometry.resize(portrait.width, portrait.height)
    await settleLayout()
    expect(region('panel').querySelector('[data-scroll-region]')).toBe(body)
    expect(body.scrollTop).toBe(100)

    await page.viewport(landscape.width, landscape.height)
    publishConditions(document.documentElement, landscape, REST)
    geometry.resize(landscape.width, landscape.height)
    await settleLayout()
    expect(body.scrollTop).toBe(100)
  })

  test('the keyboard shrinks the shell above it without moving focus off the canvas field', async () => {
    const tablet = size('ipad-pro-11-portrait')
    await page.viewport(tablet.width, tablet.height)
    publishConditions(document.documentElement, tablet, REST)
    const geometry = stubGeometry(tablet.width, tablet.height)
    mounted = mountFixture(ShellFixture, { geometry })
    await settleLayout()
    const canvas = region('canvas')
    const field = byTestId('canvas-field') as HTMLInputElement
    field.focus()

    const conditions = publishConditions(document.documentElement, tablet, KEYBOARD)
    await settleLayout()

    const keyboardTop = tablet.height - (KEYBOARD.keyboard?.(tablet) ?? 0)
    expect(conditions.reserved).toHaveLength(1)
    expect(rect('rail').bottom).toBeLessThanOrEqual(keyboardTop + 1)
    expect(region('canvas')).toBe(canvas)
    expect(document.activeElement).toBe(field)
    expect(rect('canvas').height).toBeGreaterThan(0)
  })
})
