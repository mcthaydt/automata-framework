import { describe, expect, test } from 'vitest'
import {
  applyGeometry,
  type GeometryInput,
  type HostDisplay,
  measureGeometry,
  publishedVisibleRect,
} from '#src/shared/ui/geometry/geometry.ts'

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

const host = (over: Partial<HostDisplay> = {}): HostDisplay => ({
  safeArea: NO_INSETS,
  hostReserved: { edge: 'right', rect: { x: 0, y: 0, w: 0, h: 0 } },
  scale: 1,
  ...over,
})

const input = (over: Partial<GeometryInput> = {}): GeometryInput => ({
  layout: { width: 844, height: 390 },
  envSafeArea: NO_INSETS,
  ...over,
})

describe('measureGeometry (M1.6 spec §3.1)', () => {
  test('classifies from the layout viewport', () => {
    const g = measureGeometry(input({ layout: { width: 780, height: 270 } }))
    expect(g.formFactor).toBe('phone-landscape')
    expect(g.heightTier).toBe('compact')
    expect(g.layout).toEqual({ width: 780, height: 270 })
  })

  test('standalone, the insets are the env safe area and usable is the layout less them', () => {
    const g = measureGeometry(input({ envSafeArea: { top: 0, right: 47, bottom: 21, left: 47 } }))
    expect(g.insets).toEqual({ top: 0, right: 47, bottom: 21, left: 47 })
    expect(g.hostReserved).toEqual({ left: 0, right: 0 })
    expect(g.usable).toEqual({ x: 47, y: 0, width: 750, height: 369 })
    expect(g.scale).toBe(1)
  })

  test('each side takes the larger of env and the host safe area', () => {
    const g = measureGeometry(
      input({
        envSafeArea: { top: 10, right: 0, bottom: 30, left: 0 },
        host: host({ safeArea: { top: 20, right: 5, bottom: 0, left: 0 } }),
      }),
    )
    expect(g.insets).toEqual({ top: 20, right: 5, bottom: 30, left: 0 })
  })

  test("Ruken's hostReserved becomes a strip on its edge and widens that inset", () => {
    const right = measureGeometry(
      input({ host: host({ hostReserved: { edge: 'right', rect: { x: 796, y: 167, w: 48, h: 56 } } }) }),
    )
    expect(right.hostReserved).toEqual({ left: 0, right: 48 })
    expect(right.insets.right).toBe(48)
    expect(right.usable).toEqual({ x: 0, y: 0, width: 796, height: 390 })

    const left = measureGeometry(
      input({
        envSafeArea: { top: 0, right: 0, bottom: 0, left: 60 },
        host: host({ hostReserved: { edge: 'left', rect: { x: 0, y: 0, w: 48, h: 56 } } }),
      }),
    )
    expect(left.hostReserved).toEqual({ left: 48, right: 0 })
    expect(left.insets.left).toBe(60)
  })

  test('a negative strip width clamps to 0', () => {
    const g = measureGeometry(
      input({ host: host({ hostReserved: { edge: 'left', rect: { x: 0, y: 0, w: -4, h: 0 } } }) }),
    )
    expect(g.hostReserved).toEqual({ left: 0, right: 0 })
  })

  test('a keyboard sets the visual inset and visible region, never the form factor or tier', () => {
    const rest = measureGeometry(input({ layout: { width: 390, height: 844 } }))
    const typing = measureGeometry(
      input({ layout: { width: 390, height: 844 }, visual: { height: 500.4, offsetTop: 0 } }),
    )
    expect(typing.formFactor).toBe(rest.formFactor)
    expect(typing.heightTier).toBe(rest.heightTier)
    expect(typing.visualInsetBottom).toBe(344)
    expect(typing.visible).toEqual({ x: 0, y: 0, width: 390, height: 500 })
    expect(rest.visualInsetBottom).toBe(0)
  })

  test('a scrolled visual viewport counts its offset; the inset is never negative', () => {
    expect(
      measureGeometry(input({ layout: { width: 390, height: 844 }, visual: { height: 500, offsetTop: 100 } }))
        .visualInsetBottom,
    ).toBe(244)
    expect(
      measureGeometry(input({ layout: { width: 390, height: 844 }, visual: { height: 900, offsetTop: 0 } }))
        .visualInsetBottom,
    ).toBe(0)
  })

  test('folds a hidden browser bar into the visual inset, and keeps its own count (§3.9)', () => {
    const g = measureGeometry(
      input({
        layout: { width: 411, height: 866 },
        visual: { height: 866, offsetTop: 0 },
        hiddenBarBottom: 64,
      }),
    )
    expect(g.hiddenBarBottom).toBe(64)
    expect(g.visualInsetBottom).toBe(64)
    expect(g.visible.height).toBe(866 - 64)
    expect(measureGeometry(input()).hiddenBarBottom).toBe(0)
  })

  test('a page the keyboard shrank keeps its resting class, and says how much was taken', () => {
    // Without `interactive-widget=resizes-visual` some browsers shrink the layout viewport itself.
    const resting = measureGeometry(input({ layout: { width: 390, height: 844 } }))
    const g = measureGeometry(
      input({ layout: { width: 390, height: 500 }, restingLayout: { width: 390, height: 844 } }),
    )
    expect(g.formFactor).toBe(resting.formFactor)
    expect(g.heightTier).toBe(resting.heightTier)
    expect(g.keyboardResize).toBe(344)
    expect(g.visualInsetBottom).toBe(0)
    expect(g.layout).toEqual({ width: 390, height: 500 })
    expect(measureGeometry(input()).keyboardResize).toBe(0)
  })

  test("carries the host's scale hint", () => {
    expect(measureGeometry(input({ host: host({ scale: 1.333 }) })).scale).toBe(1.333)
  })
})

describe('applyGeometry (M1.6 spec §3.2)', () => {
  test('writes every attribute and custom property, and clears the ones that no longer apply', () => {
    const root = document.createElement('div')
    applyGeometry(
      root,
      measureGeometry(
        input({
          layout: { width: 780, height: 270 },
          visual: { height: 200, offsetTop: 0 },
          envSafeArea: { top: 1, right: 2, bottom: 3, left: 4 },
          host: host({ hostReserved: { edge: 'right', rect: { x: 0, y: 0, w: 48, h: 56 } }, scale: 1.333 }),
        }),
      ),
    )
    expect(root.dataset.formFactor).toBe('phone-landscape')
    expect(root.dataset.height).toBe('compact')
    expect(root.hasAttribute('data-visual-inset')).toBe(true)
    const prop = (name: string): string => root.style.getPropertyValue(name)
    expect(prop('--af-inset-top')).toBe('1px')
    expect(prop('--af-inset-right')).toBe('48px')
    expect(prop('--af-inset-bottom')).toBe('3px')
    expect(prop('--af-inset-left')).toBe('4px')
    expect(prop('--af-host-reserved-left')).toBe('0px')
    expect(prop('--af-host-reserved-right')).toBe('48px')
    expect(prop('--af-visual-inset-bottom')).toBe('70px')
    expect(prop('--af-hidden-bar-bottom')).toBe('0px')
    expect(prop('--af-scale')).toBe('1.333')

    applyGeometry(root, measureGeometry(input({ layout: { width: 1280, height: 720 } })))
    expect(root.dataset.formFactor).toBe('desktop')
    expect(root.hasAttribute('data-height')).toBe(false)
    expect(root.hasAttribute('data-visual-inset')).toBe(false)
    expect(prop('--af-visual-inset-bottom')).toBe('0px')

    applyGeometry(root, measureGeometry(input({ layout: { width: 411, height: 866 }, hiddenBarBottom: 64 })))
    expect(root.hasAttribute('data-visual-inset')).toBe(true)
    expect(prop('--af-hidden-bar-bottom')).toBe('64px')
    expect(prop('--af-visual-inset-bottom')).toBe('64px')

    // A keyboard that shrank the page: the frame already ends above it, and scrolls what it hides.
    applyGeometry(
      root,
      measureGeometry(
        input({ layout: { width: 390, height: 500 }, restingLayout: { width: 390, height: 844 } }),
      ),
    )
    expect(root.hasAttribute('data-visual-inset')).toBe(true)
    expect(prop('--af-visual-inset-bottom')).toBe('0px')
  })
})

describe('publishedVisibleRect (M4.12b)', () => {
  test('reads back the visible region applyGeometry published', () => {
    const root = document.createElement('div')
    const geometry = measureGeometry(
      input({
        layout: { width: 780, height: 270 },
        envSafeArea: { top: 4, right: 0, bottom: 10, left: 0 },
        host: host({ hostReserved: { edge: 'left', rect: { x: 0, y: 0, w: 48, h: 270 } } }),
        visual: { height: 240, offsetTop: 0 },
      }),
    )
    applyGeometry(root, geometry)
    expect(publishedVisibleRect(root, geometry.layout)).toEqual(geometry.visible)
  })

  test('is the whole layout where nothing was published', () => {
    expect(publishedVisibleRect(document.createElement('div'), { width: 780, height: 270 })).toEqual({
      x: 0,
      y: 0,
      width: 780,
      height: 270,
    })
  })
})
