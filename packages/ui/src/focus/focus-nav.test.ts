import { beforeEach, describe, expect, it, vi } from 'vitest'
import { arrowKeyNav, FocusNavigator, scrollWithin, tabbables } from './focus-nav'

/** An element the test put there; a missing one fails the test. */
function byId(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`no #${id}`)
  return element
}

beforeEach(() => {
  document.body.innerHTML = `
    <button id="a">A</button>
    <button id="b" disabled>B</button>
    <div inert><button id="c">C</button></div>
    <input id="d" />
    <a id="e" href="#">E</a>
    <button id="f" tabindex="-1">F</button>`
})

// Ported from FloorFifty tests/client/ui/focus-nav.test.ts at 122a220, minus steer, page, adjust and the pad
// guard (M4).
describe('focus navigation', () => {
  it('walks tabbable elements in DOM order, skipping disabled, inert and untabbable ones', () => {
    expect(tabbables(document).map((element) => element.id)).toEqual(['a', 'd', 'e'])
  })

  it('skips controls that CSS hides: display none on it or an ancestor, or visibility hidden', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button id="g" style="display:none">G</button>
       <div style="display:none"><button id="h">H</button></div>
       <div style="visibility:hidden"><button id="i">I</button></div>
       <button id="j">J</button>`,
    )
    expect(tabbables(document).map((element) => element.id)).toEqual(['a', 'd', 'e', 'j'])
  })

  it('moves next and previous, wrapping at the ends', () => {
    const nav = new FocusNavigator()
    nav.move('next')
    expect(document.activeElement?.id).toBe('a')
    nav.move('next')
    nav.move('next')
    nav.move('next')
    expect(document.activeElement?.id).toBe('a')
    nav.move('previous')
    expect(document.activeElement?.id).toBe('e')
  })

  it('does nothing while paused (a screen transition), and resumes where it was', () => {
    const nav = new FocusNavigator()
    nav.move('next')
    expect(document.activeElement?.id).toBe('a')
    nav.setPaused(true)
    nav.move('next')
    const click = vi.fn()
    byId('a').addEventListener('click', click)
    nav.confirm()
    expect(document.activeElement?.id).toBe('a')
    expect(click).not.toHaveBeenCalled()
    nav.setPaused(false)
    nav.move('next')
    expect(document.activeElement?.id).toBe('d')
  })

  it('stays inside an open modal', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="dialog" aria-modal="true"><button id="m1">1</button><button id="m2">2</button></div>`,
    )
    const nav = new FocusNavigator()
    nav.move('next')
    nav.move('next')
    nav.move('next')
    expect(document.activeElement?.id).toBe('m1')
  })

  it('stays inside the topmost of two stacked modals', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="dialog" aria-modal="true"><button id="under">under</button></div>` +
        `<div role="dialog" aria-modal="true"><button id="top1">1</button><button id="top2">2</button></div>`,
    )
    const nav = new FocusNavigator()
    nav.move('next')
    nav.move('next')
    nav.move('next')
    expect(document.activeElement?.id).toBe('top1')
  })

  it('passes over a modal that is leaving (inert) to the page beneath it', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div inert><div role="dialog" aria-modal="true"><button id="gone">gone</button></div></div>`,
    )
    const nav = new FocusNavigator()
    nav.move('next')
    expect(document.activeElement?.id).toBe('a')
  })

  it('confirms by clicking, and backs out with Escape', () => {
    const nav = new FocusNavigator()
    nav.move('next')
    const click = vi.fn()
    byId('a').addEventListener('click', click)
    const onEscape = vi.fn()
    document.addEventListener('keydown', (event) => event.key === 'Escape' && onEscape())
    nav.confirm()
    nav.back()
    expect(click).toHaveBeenCalledOnce()
    expect(onEscape).toHaveBeenCalledOnce()
  })
})

describe('what a controller player sees', () => {
  it('asks for the focus ring, which a browser withholds from script focus after a click', () => {
    // Chromium shows :focus-visible for a script's focus() only when the
    // last interaction was a key; after any click or tap, a pad walked the
    // menu with no ring at all.
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    new FocusNavigator().move('next')
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: true })
    focus.mockRestore()
  })
})

describe('the page around the game', () => {
  it('never scrolls the document to reach an element', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const into = vi.fn()
    HTMLElement.prototype.scrollIntoView = into
    new FocusNavigator().move('next')
    expect(scrollTo).not.toHaveBeenCalled()
    expect(into).not.toHaveBeenCalled()
    scrollTo.mockRestore()
  })

  it("scrolls the element's own scroll box instead", () => {
    document.body.innerHTML = `<div id="box" style="overflow-y: auto"><button id="deep">Deep</button></div>`
    const box = byId('box')
    const deep = byId('deep')
    Object.defineProperty(box, 'scrollHeight', { value: 500 })
    Object.defineProperty(box, 'clientHeight', { value: 100 })
    box.getBoundingClientRect = () => ({ top: 0, bottom: 100 }) as DOMRect
    deep.getBoundingClientRect = () => ({ top: 150, bottom: 190 }) as DOMRect
    scrollWithin(deep)
    expect(box.scrollTop).toBe(90)
  })

  it('clicks unguarded buttons however they got focus', () => {
    const click = vi.fn()
    byId('a').addEventListener('click', click)
    byId('a').focus()
    new FocusNavigator().confirm()
    expect(click).toHaveBeenCalledOnce()
  })

  it('sends Back as an untrusted, pad-tagged Escape the browser takes no action on', async () => {
    const { padKeyEvents } = await import('./focus-nav')
    let heard: KeyboardEvent | undefined
    document.addEventListener('keydown', (event) => (heard = event), { once: true })
    new FocusNavigator().back()
    expect(heard?.isTrusted).toBe(false)
    expect(padKeyEvents.has(heard as KeyboardEvent)).toBe(true)
  })
})

describe('when the screen changes under the pad', () => {
  /** A navigator the pad has used, whose focused element then left the page. */
  const afterScreenChange = () => {
    const nav = new FocusNavigator()
    nav.move('next')
    document.body.innerHTML = `<button id="n1">Next 1</button><button id="n2">Next 2</button>`
    return nav
  }

  it("puts focus on the new screen's first control, with a ring, rather than leaving it on the page", () => {
    const nav = afterScreenChange()
    expect(document.activeElement).toBe(document.body)
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    nav.recover()
    expect(document.activeElement?.id).toBe('n1')
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: true })
    focus.mockRestore()
  })

  it('leaves focus where it is while something holds it', () => {
    const nav = afterScreenChange()
    byId('n2').focus()
    nav.recover()
    expect(document.activeElement?.id).toBe('n2')
  })

  it('brings focus into a dialog it has strayed out of', () => {
    const nav = afterScreenChange()
    byId('n1').focus()
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="dialog" aria-modal="true"><button id="m1">1</button></div>`,
    )
    nav.recover()
    expect(document.activeElement?.id).toBe('m1')
  })

  it('does nothing before the pad has moved focus at all', () => {
    new FocusNavigator().recover()
    expect(document.activeElement).toBe(document.body)
  })

  it("hands focus back to the page after a mouse, touch or keyboard press, but not the pad's own Back", () => {
    for (const press of [
      () => window.dispatchEvent(new Event('pointerdown')),
      () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' })),
    ]) {
      const nav = afterScreenChange()
      const detach = nav.attach(window)
      press()
      nav.recover()
      expect(document.activeElement).toBe(document.body)
      detach()
    }

    const nav = afterScreenChange()
    const detach = nav.attach(window)
    nav.back() // the pad's Escape reaches window too
    nav.recover()
    expect(document.activeElement?.id).toBe('n1')
    detach()
  })
})

describe('the arrow keys in the menus', () => {
  const key = (code: string, init: KeyboardEventInit = {}): KeyboardEvent =>
    new KeyboardEvent('keydown', { code, key: code, ...init })

  it('walk the menus as the d-pad does', () => {
    expect(arrowKeyNav(key('ArrowUp'))).toBe('up')
    expect(arrowKeyNav(key('ArrowDown'))).toBe('down')
    expect(arrowKeyNav(key('ArrowLeft'))).toBe('left')
    expect(arrowKeyNav(key('ArrowRight'))).toBe('right')
  })

  it('leave other keys and modified arrows alone', () => {
    expect(arrowKeyNav(key('KeyA'))).toBeUndefined()
    expect(arrowKeyNav(key('ArrowUp', { shiftKey: true }))).toBeUndefined()
    expect(arrowKeyNav(key('ArrowUp', { altKey: true }))).toBeUndefined()
  })

  const pressOn = (id: string, code: string): ReturnType<typeof arrowKeyNav> => {
    const event = key(code)
    byId(id).dispatchEvent(event)
    return arrowKeyNav(event)
  }

  it('never let an input hold focus: Up and Down always walk off it', () => {
    document.body.innerHTML = `<input id="t" value="abc" /><input id="r" type="range" /><input id="o" type="radio" />`
    for (const id of ['t', 'r', 'o']) {
      expect(pressOn(id, 'ArrowUp')).toBe('up')
      expect(pressOn(id, 'ArrowDown')).toBe('down')
    }
  })

  it('leave a slider and a radio group their sideways arrows', () => {
    document.body.innerHTML = `<input id="r" type="range" /><input id="o" type="radio" /><input id="c" type="checkbox" />`
    expect(pressOn('r', 'ArrowRight')).toBeUndefined()
    expect(pressOn('o', 'ArrowLeft')).toBeUndefined()
    expect(pressOn('c', 'ArrowRight')).toBe('right')
  })

  it("move a text field's caret sideways until it reaches the end", () => {
    document.body.innerHTML = `<input id="t" value="abc" />`
    const input = document.getElementById('t') as HTMLInputElement
    input.setSelectionRange(1, 1)
    expect(pressOn('t', 'ArrowLeft')).toBeUndefined()
    expect(pressOn('t', 'ArrowRight')).toBeUndefined()
    input.setSelectionRange(0, 0)
    expect(pressOn('t', 'ArrowLeft')).toBe('left')
    input.setSelectionRange(3, 3)
    expect(pressOn('t', 'ArrowRight')).toBe('right')
    input.setSelectionRange(0, 3)
    expect(pressOn('t', 'ArrowLeft')).toBeUndefined()
  })

  it('leave multi-line text and dropdowns every arrow', () => {
    document.body.innerHTML = `<textarea id="a"></textarea><select id="s"></select>`
    expect(pressOn('a', 'ArrowDown')).toBeUndefined()
    expect(pressOn('s', 'ArrowDown')).toBeUndefined()
  })
})

describe("with AF's Dialog", () => {
  it('Back closes an open Dialog through its Escape, and focus stays in the dialog while it is open', async () => {
    const { render, screen } = await import('@testing-library/svelte')
    const { textSnippet } = await import('@mcthaydt/automata-testing')
    const Dialog = (await import('../dialog/Dialog.svelte')).default
    document.body.innerHTML = ''
    const onclose = vi.fn()
    render(Dialog, {
      title: 'Leave?',
      onclose,
      children: textSnippet('Sure?'),
      actions: textSnippet('<button>Stay</button><button>Leave</button>', 'div', true),
    })
    const nav = new FocusNavigator()
    nav.move('next')
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    nav.back()
    expect(onclose).toHaveBeenCalledOnce()
  })
})

/** Gives `element` a fixed box, as layout would (jsdom lays nothing out). */
function place(element: HTMLElement, left: number, top: number, size = 40): void {
  element.getBoundingClientRect = () =>
    ({
      left,
      top,
      right: left + size,
      bottom: top + size,
      width: size,
      height: size,
      x: left,
      y: top,
    }) as DOMRect
}

// M4 spec §4.7: steer is spatial inside a focus grid and DOM order elsewhere.
describe('steer', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="before">Before</button>
      <div data-focus-grid>
        <button id="g0">0</button><button id="g1">1</button><button id="g2">2</button>
        <button id="g3">3</button><button id="g4">4</button><button id="g5">5</button>
      </div>
      <button id="after">After</button>`
    for (let cell = 0; cell < 6; cell++) place(byId(`g${cell}`), (cell % 3) * 50, Math.floor(cell / 3) * 50)
  })

  it('moves to the nearest cell that way inside a grid, not the next in DOM order', () => {
    const nav = new FocusNavigator()
    byId('g0').focus()
    expect(nav.steer('down')).toBe(true)
    expect(document.activeElement?.id).toBe('g3')
    expect(nav.steer('right')).toBe(true)
    expect(document.activeElement?.id).toBe('g4')
    expect(nav.steer('up')).toBe(true)
    expect(document.activeElement?.id).toBe('g1')
  })

  it('keeps focus and reports false at a grid edge with nothing that way', () => {
    const nav = new FocusNavigator()
    byId('g2').focus()
    expect(nav.steer('right')).toBe(false)
    expect(document.activeElement?.id).toBe('g2')
  })

  it('walks DOM order outside a grid: down and right go next, up and left go previous', () => {
    const nav = new FocusNavigator()
    byId('before').focus()
    expect(nav.steer('right')).toBe(true)
    expect(document.activeElement?.id).toBe('g0')
    byId('after').focus()
    expect(nav.steer('up')).toBe(true)
    expect(document.activeElement?.id).toBe('g5')
  })

  it('does nothing while paused', () => {
    const nav = new FocusNavigator()
    byId('g0').focus()
    nav.setPaused(true)
    expect(nav.steer('down')).toBe(false)
    expect(document.activeElement?.id).toBe('g0')
  })
})

// M4 spec §4.7: a page turn goes to the focused control's `[data-pager]` region, which takes it by cancelling.
describe('page', () => {
  it('offers af-page with the delta to the focused element and reports whether a pager took it', () => {
    document.body.innerHTML = `<div data-pager id="pager"><button id="in">In</button></div><button id="out">Out</button>`
    const deltas: number[] = []
    byId('pager').addEventListener('af-page', (event) => {
      deltas.push((event as CustomEvent<{ delta: number }>).detail.delta)
      event.preventDefault()
    })
    const nav = new FocusNavigator()
    byId('in').focus()
    expect(nav.page(1)).toBe(true)
    expect(nav.page(-1)).toBe(true)
    expect(deltas).toEqual([1, -1])
    byId('out').focus()
    expect(nav.page(1)).toBe(false)
    expect(deltas).toEqual([1, -1])
  })
})

// M4 spec §4.7: adjust changes a slider or an option group in place; focus never leaves it.
describe('adjust', () => {
  it('steps a focused range once and fires one input event', () => {
    document.body.innerHTML = `<input id="volume" type="range" min="0" max="10" step="1" value="5" />`
    const volume = byId('volume') as HTMLInputElement
    let inputs = 0
    volume.addEventListener('input', () => inputs++)
    volume.focus()
    const nav = new FocusNavigator()
    expect(nav.adjust(1)).toBe(true)
    expect(volume.value).toBe('6')
    expect(nav.adjust(-1)).toBe(true)
    expect(volume.value).toBe('5')
    expect(inputs).toBe(2)
  })

  it('checks the next radio in a focused group, fires change, and keeps focus in the group', () => {
    document.body.innerHTML = `
      <div role="radiogroup">
        <input id="low" type="radio" name="quality" value="low" checked />
        <input id="mid" type="radio" name="quality" value="mid" />
        <input id="high" type="radio" name="quality" value="high" />
      </div>`
    let changes = 0
    byId('mid').addEventListener('change', () => changes++)
    byId('low').focus()
    const nav = new FocusNavigator()
    expect(nav.adjust(1)).toBe(true)
    expect((byId('mid') as HTMLInputElement).checked).toBe(true)
    expect(document.activeElement?.id).toBe('mid')
    expect(changes).toBe(1)
    expect(nav.adjust(-1)).toBe(true)
    expect(document.activeElement?.id).toBe('low')
  })

  it('reports false on anything else, so the caller steers instead', () => {
    document.body.innerHTML = `<button id="plain">Plain</button>`
    byId('plain').focus()
    expect(new FocusNavigator().adjust(1)).toBe(false)
  })
})
