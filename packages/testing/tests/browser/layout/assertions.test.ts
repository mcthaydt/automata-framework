import { afterEach, describe, expect, test } from 'vitest'
import {
  documentScrolls,
  findClipped,
  findCutAtSide,
  findIntrusions,
  findOffscreenControls,
  findOverlaps,
  findSmallTargets,
  findUnreachable,
  pressedPart,
  visibleControls,
} from '#src/layout/assertions.ts'

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

  test('reports a control a scroller shows only part of: the whole box must be in view', () => {
    document.body.innerHTML =
      '<div data-scroll-region style="position:fixed;left:0;top:0;width:200px;height:100px;overflow:auto">' +
      '<button data-testid="cut" style="display:block;margin-top:68px;width:60px;height:48px">x</button></div>'
    expect(findUnreachable([document.querySelector('[data-testid="cut"]') as Element])).toEqual([
      'cut is covered or clipped at its bottom edge',
    ])
  })

  test('passes a pill-shaped control: its edges are tested just inside, away from the corners', () => {
    const pill = plant(button('pill', 'left:10px;top:10px;width:120px;height:48px;border-radius:24px'))
    expect(findUnreachable([pill])).toEqual([])
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

  test('size-checks every kind of control a player can press or tab to', () => {
    const at = (left: number): string =>
      `position:fixed;left:${left}px;top:0;width:20px;height:20px;display:block`
    document.body.innerHTML =
      `<a href="#x" data-testid="link" style="${at(0)}">a</a>` +
      `<span role="link" data-testid="role-link" style="${at(30)}">b</span>` +
      `<span role="tab" data-testid="tab" style="${at(60)}">c</span>` +
      `<details style="${at(90)}"><summary data-testid="summary" style="display:block;height:20px">d</summary></details>` +
      `<div tabindex="0" data-testid="focusable" style="${at(120)}">e</div>` +
      `<div tabindex="-1" data-testid="programmatic" style="${at(150)}">f</div>`
    expect(findSmallTargets(document.body, 44, 48).map((problem) => problem.split(' ')[0])).toEqual([
      'link',
      'role-link',
      'tab',
      'summary',
      'focusable',
    ])
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

  test('reports a fixed control off screen inside a declared region, which does not clip it', () => {
    document.body.innerHTML =
      '<div data-scroll-region style="position:fixed;left:0;top:0;width:100px;height:100px;overflow:auto">' +
      button('escaped', 'left:-200px;top:0;width:60px;height:48px') +
      '</div>'
    expect(findOffscreenControls(document.body)).toEqual(['escaped is off screen'])
  })

  test('reports a control in a box that scrolls but was never declared a scroll region', () => {
    document.body.innerHTML =
      '<div style="position:fixed;left:0;top:0;width:100px;height:100px;overflow:auto">' +
      '<div style="height:2000px"></div><button data-testid="undeclared" style="height:48px">x</button></div>'
    expect(findOffscreenControls(document.body)).toEqual(['undeclared is off screen'])
  })
})

describe('pressedPart', () => {
  test("is a checkbox's or radio's label, and any other control itself", () => {
    document.body.innerHTML =
      '<label data-testid="label"><input type="checkbox" data-testid="box">Music</label>' +
      '<button data-testid="play">Play</button>'
    const part = (id: string): Element =>
      pressedPart(document.querySelector(`[data-testid="${id}"]`) as HTMLElement)
    expect(part('box')).toBe(document.querySelector('[data-testid="label"]'))
    expect(part('play')).toBe(document.querySelector('[data-testid="play"]'))
  })
})

describe('findCutAtSide', () => {
  /** A declared region 200 px wide that scrolls up and down (or as `axis` says), holding `inner`. */
  const region = (inner: string, axis = ''): string =>
    `<div data-scroll-region="${axis}" style="position:fixed;left:0;top:0;width:200px;height:100px;overflow:auto">${inner}</div>`
  const far = (id: string, style = ''): string =>
    `<div style="width:300px"><button data-testid="${id}" style="margin-left:180px;width:60px;height:48px;${style}">x</button></div>`

  test('reports a control cut at the side of a region that scrolls up and down, and passes one below the fold', () => {
    const low =
      '<button data-testid="low" style="display:block;margin-top:200px;width:60px;height:48px">x</button>'
    document.body.innerHTML = region(far('cut') + low)
    expect(findCutAtSide(document.body)).toEqual(['cut is cut at the side of its scroll region'])
  })

  test('judges a radio by its label, which is what a player presses', () => {
    document.body.innerHTML = region(
      '<div style="width:300px"><label data-testid="option" style="display:inline-block;margin-left:180px;width:60px;height:48px">' +
        '<input type="radio" style="position:absolute;width:1px;height:1px;clip-path:inset(50%)">x</label></div>',
    )
    expect(findCutAtSide(document.body)).toEqual(['option is cut at the side of its scroll region'])
  })

  test('passes a control past the side of a region that scrolls sideways on purpose (data-scroll-region="both")', () => {
    document.body.innerHTML = region(far('strip'), 'both')
    expect(findCutAtSide(document.body)).toEqual([])
  })

  test('passes a control the region does not clip: a fixed one, or an absolute one positioned outside it', () => {
    document.body.innerHTML =
      '<div style="position:relative;width:400px;height:200px">' +
      '<div data-scroll-region style="width:200px;height:100px;overflow:auto">' +
      '<button data-testid="pinned" style="position:absolute;left:250px;top:0;width:60px;height:48px">x</button>' +
      button('fixed', 'left:250px;top:60px;width:60px;height:48px') +
      '</div></div>'
    expect(findCutAtSide(document.body)).toEqual([])
  })

  test('walks out through nested regions: an inner region wider than the outer one is cut at the outer side', () => {
    const inner = `<div data-scroll-region style="width:300px;height:80px;overflow:auto">${far('nested')}</div>`
    document.body.innerHTML = region(inner)
    expect(findCutAtSide(document.body)).toEqual(['nested is cut at the side of its scroll region'])
  })

  test('stops at a region that scrolls sideways: what it holds is reached by scrolling it', () => {
    const inner = `<div data-scroll-region="both" style="width:200px;height:80px;overflow:auto">${far('scene')}</div>`
    document.body.innerHTML = region(inner)
    expect(findCutAtSide(document.body)).toEqual([])
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

  test('reports a fixed control under an area even inside a clear declared region: the region does not clip it', () => {
    document.body.innerHTML =
      '<div data-scroll-region style="position:fixed;left:0;top:0;width:300px;height:200px;overflow:auto">' +
      button('fixed', 'left:300px;top:10px;width:48px;height:48px') +
      '</div>'
    expect(findIntrusions(document.body, [strip])).toEqual(['fixed is under a reserved area'])
  })

  test("reports an absolute control whose containing block is outside the region, which escapes the region's clip", () => {
    const keyboard = { x: 0, y: 100, width: 400, height: 100 }
    document.body.innerHTML =
      '<div style="position:relative;height:300px">' +
      '<div data-scroll-region style="height:100px;overflow:auto">' +
      '<button data-testid="escapes" style="position:absolute;left:0;top:120px;width:60px;height:48px">x</button>' +
      '</div></div>'
    expect(findIntrusions(document.body, [keyboard])).toEqual(['escapes is under a reserved area'])
  })

  test('passes an absolute control positioned inside the region, which the region clips', () => {
    const keyboard = { x: 0, y: 100, width: 400, height: 100 }
    document.body.innerHTML =
      '<div data-scroll-region style="position:fixed;left:0;top:0;width:200px;height:100px;overflow:auto">' +
      '<button data-testid="clipped" style="position:absolute;left:0;top:120px;width:60px;height:48px">x</button>' +
      '</div>'
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
