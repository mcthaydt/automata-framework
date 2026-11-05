import { afterEach, describe, expect, it, vi } from 'vitest'
import { holdModal, inertOutside, isTopmost, wrapTab } from '#src/dialog/modal-scope.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

function page(html: string): void {
  document.body.innerHTML = html
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`no #${id}`)
  return element
}

function tab(shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })
}

describe('inertOutside', () => {
  it('marks the siblings of the node and of each ancestor up to the body, and nothing inside', () => {
    page(
      '<header id="h"></header><main id="m"><p id="p"></p><div id="d"><button id="b"></button></div></main>',
    )
    const release = inertOutside(byId('d'))
    expect(['h', 'p'].map((id) => byId(id).hasAttribute('inert'))).toEqual([true, true])
    expect(['m', 'd', 'b'].map((id) => byId(id).hasAttribute('inert'))).toEqual([false, false, false])
    release()
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
  })

  it('undoes only what it marked, so an element already inert stays inert', () => {
    page('<header id="h" inert></header><aside id="a"></aside><div id="d"></div>')
    const release = inertOutside(byId('d'))
    expect(byId('a').hasAttribute('inert')).toBe(true)
    release()
    expect(byId('a').hasAttribute('inert')).toBe(false)
    expect(byId('h').hasAttribute('inert')).toBe(true)
  })
})

describe('isTopmost', () => {
  it('is the last aria-modal in the document that is not inside something inert', () => {
    page(
      '<div id="one" aria-modal="true"></div><div id="two" aria-modal="true"></div><div inert><div id="three" aria-modal="true"></div></div>',
    )
    expect(isTopmost(byId('one'))).toBe(false)
    expect(isTopmost(byId('two'))).toBe(true)
    expect(isTopmost(byId('three'))).toBe(false)
  })
})

describe('wrapTab', () => {
  it('wraps Tab from the last control to the first and Shift+Tab from the first to the last', () => {
    page(
      '<div id="panel" tabindex="-1"><button id="a"></button><button id="b" disabled></button><button id="c"></button></div>',
    )
    const panel = byId('panel')
    byId('c').focus()
    const forward = tab()
    wrapTab(forward, panel)
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('a')

    const back = tab(true)
    wrapTab(back, panel)
    expect(back.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('c')
  })

  it('leaves Tab between two inner controls to the browser, and holds focus on a panel with none', () => {
    page(
      '<div id="panel" tabindex="-1"><button id="a"></button><button id="c"></button></div><div id="empty" tabindex="-1"></div>',
    )
    byId('a').focus()
    const middle = tab()
    wrapTab(middle, byId('panel'))
    expect(middle.defaultPrevented).toBe(false)

    const none = tab()
    wrapTab(none, byId('empty'))
    expect(none.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('empty')
  })
})

describe('holdModal', () => {
  it('focuses the marked control, answers Escape while topmost, and gives focus back on release', () => {
    page(
      '<button id="opener"></button><div id="scrim"><div id="panel" aria-modal="true" tabindex="-1"><button id="x"></button><button id="safe" data-initial-focus></button></div></div>',
    )
    byId('opener').focus()
    const onclose = vi.fn()
    const release = holdModal(byId('scrim'), byId('panel'), onclose)
    expect(document.activeElement?.id).toBe('safe')
    expect(byId('opener').hasAttribute('inert')).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(onclose).toHaveBeenCalledOnce()

    byId('opener').removeAttribute('inert')
    byId('opener').focus()
    expect(document.activeElement?.id).toBe('safe')

    release()
    expect(document.activeElement?.id).toBe('opener')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('with no opener left, gives focus where a screen puts it on entry: the autofocus control, else the primary one', () => {
    // A cover held from boot (the landscape gate): the menu mounts behind it, inert, so the menu's own focus call
    // did nothing, and nothing was focused when the cover opened.
    page(
      '<section><button id="other"></button><button id="play" data-kind="primary"></button></section><div id="scrim"><div id="panel" aria-modal="true" tabindex="-1"><button id="go"></button></div></div>',
    )
    const release = holdModal(byId('scrim'), byId('panel'), () => undefined)
    expect(document.activeElement?.id).toBe('go')
    release()
    expect(document.activeElement?.id).toBe('play')

    page(
      '<section><button id="play" data-kind="primary"></button><button id="named" data-autofocus></button></section><div id="scrim"><div id="panel" aria-modal="true" tabindex="-1"><button id="go"></button></div></div>',
    )
    holdModal(byId('scrim'), byId('panel'), () => undefined)()
    expect(document.activeElement?.id).toBe('named')
  })
})
