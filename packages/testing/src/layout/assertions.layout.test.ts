import { afterEach, describe, expect, test } from 'vitest'
import {
  documentScrolls,
  findClipped,
  findIntrusions,
  findOffscreenControls,
  findOverlaps,
  findSmallTargets,
  findUnreachable,
  visibleControls,
} from './assertions'

// Each finder against a planted problem, and against a clean page (M1.6 spec §3.10). Real browsers:
// jsdom has no layout, so a box there is always 0x0.

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
  document.body.removeAttribute('style')
})

/** Plants `html` in the body and returns the element `selector` names. */
function plant(html: string, selector = '[data-testid]'): HTMLElement {
  document.body.innerHTML = html
  const element = document.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`nothing matches ${selector}`)
  return element
}

const button = (id: string, style: string): string =>
  `<button data-testid="${id}" style="position:fixed;${style}">${id}</button>`

describe('findUnreachable', () => {
  test('passes a control fully on screen whose centre hits it', () => {
    expect(findUnreachable([plant(button('ok', 'left:10px;top:10px;width:60px;height:48px'))])).toEqual([])
  })

  test('reports a control whose centre is covered', () => {
    document.body.innerHTML =
      button('under', 'left:10px;top:10px;width:60px;height:48px') +
      '<div style="position:fixed;left:0;top:0;width:200px;height:200px;z-index:1"></div>'
    const under = document.querySelector('[data-testid="under"]') as Element
    expect(findUnreachable([under])).toEqual(['under is covered or clipped at its centre'])
  })

  test('reports a control below the fold', () => {
    const below = plant(button('below', 'left:10px;top:calc(100vh - 20px);width:60px;height:48px'))
    expect(findUnreachable([below])).toContain('below is below the fold')
  })
})

describe('visibleControls', () => {
  test('lists the controls a player could see and press, leaving out hidden, empty and inert ones', () => {
    document.body.innerHTML =
      button('shown', 'left:0;top:0;width:60px;height:48px') +
      button('hidden', 'left:0;top:60px;width:60px;height:48px;visibility:hidden') +
      button('empty', 'left:0;top:120px;display:none') +
      `<div inert>${button('inert', 'left:100px;top:0;width:60px;height:48px')}</div>`
    expect(visibleControls(document.body).map((node) => node.dataset.testid)).toEqual(['shown'])
  })
})

describe('findSmallTargets', () => {
  test('passes 44 px controls and a 48 px primary', () => {
    document.body.innerHTML =
      button('a', 'left:0;top:0;width:44px;height:44px') +
      '<button data-testid="go" data-kind="primary" style="position:fixed;left:60px;top:0;width:120px;height:48px">Go</button>'
    expect(findSmallTargets(document.body, 44, 48)).toEqual([])
  })

  test('knows a primary by data-kind="primary" alone, the marker the CSS sizes it by', () => {
    document.body.innerHTML =
      '<button data-testid="styled" class="af-control--primary" style="position:fixed;left:0;top:0;width:120px;height:44px">A</button>'
    expect(findSmallTargets(document.body, 44, 48)).toEqual([])
  })

  test('reports a 30 px button and a primary under 48', () => {
    document.body.innerHTML =
      button('tiny', 'left:0;top:0;width:30px;height:30px') +
      '<button data-testid="go" data-kind="primary" style="position:fixed;left:60px;top:0;width:120px;height:44px">Go</button>'
    expect(findSmallTargets(document.body, 44, 48)).toEqual(['tiny is 30x30', 'go (primary) is 120x44'])
  })

  test("counts a checkbox's label as its target", () => {
    document.body.innerHTML =
      '<label style="display:block;width:200px;height:44px"><input data-testid="box" type="checkbox" style="width:20px;height:20px"> Music</label>'
    expect(findSmallTargets(document.body, 44, 48)).toEqual([])
  })
})

describe('findOffscreenControls', () => {
  test('reports a control off screen, but not one inside a declared scroll region', () => {
    document.body.innerHTML =
      button('gone', 'left:-200px;top:0;width:60px;height:48px') +
      '<div data-scroll-region style="position:fixed;left:0;top:0;width:100px;height:100px;overflow:auto">' +
      '<div style="height:2000px"></div><button data-testid="later" style="height:48px">later</button></div>'
    expect(findOffscreenControls(document.body)).toEqual(['gone is off screen'])
  })

  test('reports a control in a box that scrolls but was never declared a scroll region', () => {
    document.body.innerHTML =
      '<div style="position:fixed;left:0;top:0;width:100px;height:100px;overflow:auto">' +
      '<div style="height:2000px"></div><button data-testid="undeclared" style="height:48px">x</button></div>'
    expect(findOffscreenControls(document.body)).toEqual(['undeclared is off screen'])
  })
})

describe('findClipped', () => {
  test('reports a row that clips its own content and passes one that fits', () => {
    document.body.innerHTML =
      '<div class="row" data-testid="crushed" style="height:20px;overflow:hidden"><div style="height:44px"></div></div>' +
      '<div class="row" data-testid="whole" style="height:44px;overflow:hidden"><div style="height:44px"></div></div>'
    expect(findClipped(document.body, '.row')).toEqual(['crushed clips 24px'])
  })
})

describe('findOverlaps', () => {
  test('reports two boxes that overlap, and passes two apart', () => {
    document.body.innerHTML =
      button('a', 'left:0;top:0;width:60px;height:48px') +
      button('b', 'left:50px;top:0;width:60px;height:48px') +
      button('c', 'left:200px;top:0;width:60px;height:48px')
    const [a, b, c] = ['a', 'b', 'c'].map((id) => document.querySelector(`[data-testid="${id}"]`) as Element)
    expect(findOverlaps(a as Element, b as Element)).toEqual(['a overlaps b'])
    expect(findOverlaps(a as Element, c as Element)).toEqual([])
  })
})

describe('findIntrusions', () => {
  const strip = { x: 300, y: 0, width: 48, height: 200 }

  test('reports a control under a reserved strip, and passes one beside it', () => {
    document.body.innerHTML =
      button('under', 'left:290px;top:10px;width:60px;height:48px') +
      button('beside', 'left:200px;top:10px;width:60px;height:48px')
    expect(findIntrusions(document.body, [strip])).toEqual(['under is under a reserved area'])
  })

  test('allows a sub-pixel touch, as a browser rounds an edge', () => {
    document.body.innerHTML = button('edge', 'left:240.25px;top:10px;width:60px;height:48px')
    expect(findIntrusions(document.body, [{ x: 300, y: 0, width: 48, height: 200 }])).toEqual([])
  })

  test('reports a fixed control under a strip even inside a scroller, which does not clip it', () => {
    document.body.innerHTML =
      '<div style="position:fixed;left:0;top:0;width:100px;height:100px;overflow:auto">' +
      button('fixed', 'left:290px;top:10px;width:60px;height:48px') +
      '</div>'
    expect(findIntrusions(document.body, [strip])).toEqual(['fixed is under a reserved area'])
  })

  test('passes a control in a declared scroll region that ends above the area: it scrolls into view', () => {
    const keyboard = { x: 0, y: 100, width: 400, height: 100 }
    document.body.innerHTML =
      '<div data-scroll-region style="position:fixed;left:0;top:0;width:200px;height:100px;overflow:auto">' +
      '<button data-testid="below" style="display:block;margin-top:120px;width:60px;height:48px">x</button></div>'
    expect(findIntrusions(document.body, [keyboard])).toEqual([])
  })

  test('reports a control in a scroller that is not declared, or whose region itself reaches the area', () => {
    const keyboard = { x: 0, y: 100, width: 400, height: 100 }
    document.body.innerHTML =
      '<div style="position:fixed;left:0;top:0;width:200px;height:100px;overflow:auto">' +
      '<button data-testid="undeclared" style="display:block;margin-top:120px;width:60px;height:48px">x</button></div>' +
      '<div data-scroll-region style="position:fixed;left:250px;top:0;width:100px;height:150px;overflow:auto">' +
      '<button data-testid="region-under" style="display:block;margin-top:120px;width:60px;height:48px">y</button></div>'
    expect(findIntrusions(document.body, [keyboard])).toEqual([
      'undeclared is under a reserved area',
      'region-under is under a reserved area',
    ])
  })
})

describe('documentScrolls', () => {
  test('passes a page that fits, and reports one taller than the viewport', () => {
    document.body.style.margin = '0'
    document.body.innerHTML = '<div style="height:10px"></div>'
    expect(documentScrolls(document)).toEqual([])
    document.body.innerHTML = '<div style="height:200vh"></div>'
    expect(documentScrolls(document)).toEqual(['the page scrolls vertically'])
  })
})
