import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Modal from '#src/shared/ui/dialog/Modal.svelte'
import Sheet from '#src/shared/ui/dialog/Sheet.svelte'

// The cases of the scoping Dialog shares (modal-scope.ts).
let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

const body = createRawSnippet(() => ({ render: () => '<p>Pick a level.</p>' }))
const actions = createRawSnippet(() => ({
  render: () =>
    '<div><button type="button" id="first">Easy</button><button type="button" id="last">Hard</button></div>',
}))

function open(
  which: typeof Modal | typeof Sheet,
  props: { onclose?: () => void; onbackdrop?: (() => void) | undefined } = {},
) {
  const opener = document.createElement('button')
  opener.id = 'opener'
  document.body.append(opener)
  opener.focus()
  const target = document.createElement('div')
  document.body.append(target)
  component = mount(which, {
    target,
    props: { title: 'Level', closeLabel: 'Close', onclose: () => {}, children: body, actions, ...props },
  })
  flushSync()
  const panel = target.querySelector<HTMLElement>('[role="dialog"]')
  if (panel === null) throw new Error('no dialog')
  return { opener, target, panel }
}

function key(name: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, shiftKey, cancelable: true, bubbles: true })
  window.dispatchEvent(event)
  return event
}

describe('Modal', () => {
  it('is a modal dialog named by its title', () => {
    const { panel } = open(Modal)
    expect(panel.getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(panel.getAttribute('aria-labelledby') ?? '')
    expect(title?.textContent).toBe('Level')
  })

  it('moves focus in on open, wraps Tab, closes on Escape and gives focus back to the opener', () => {
    const onclose = vi.fn()
    const { opener, panel } = open(Modal, { onclose })
    expect(panel.contains(document.activeElement)).toBe(true)
    expect(opener.hasAttribute('inert')).toBe(true)

    document.getElementById('last')?.focus()
    expect(key('Tab').defaultPrevented).toBe(true)
    expect(panel.contains(document.activeElement)).toBe(true)

    key('Escape')
    expect(onclose).toHaveBeenCalledOnce()
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    expect(document.activeElement).toBe(opener)
    expect(opener.hasAttribute('inert')).toBe(false)
  })

  it('has a visible Close button named by closeLabel, which calls onclose', () => {
    const onclose = vi.fn()
    const { panel } = open(Modal, { onclose })
    const close = panel.querySelector<HTMLButtonElement>('[data-modal-close]')
    expect(close?.getAttribute('aria-label')).toBe('Close')
    close?.click()
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('calls onbackdrop for a tap on the scrim only when one is given, and never for a tap inside', () => {
    const onbackdrop = vi.fn()
    const { target, panel } = open(Modal, { onbackdrop })
    panel.click()
    expect(onbackdrop).not.toHaveBeenCalled()
    target.querySelector<HTMLElement>('[data-modal-scrim]')?.click()
    expect(onbackdrop).toHaveBeenCalledOnce()

    unmount(component as ReturnType<typeof mount>)
    component = undefined
    document.body.innerHTML = ''
    const onclose = vi.fn()
    const again = open(Modal, { onclose })
    again.target.querySelector<HTMLElement>('[data-modal-scrim]')?.click()
    expect(onclose).not.toHaveBeenCalled()
  })
})

describe('Sheet', () => {
  it('holds the page as a Modal does, anchored to the bottom edge, with its body a declared scroll region', () => {
    const onclose = vi.fn()
    const { opener, target, panel } = open(Sheet, { onclose })
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(panel.contains(document.activeElement)).toBe(true)
    expect(target.querySelector('[data-modal-scrim]')?.getAttribute('data-anchor')).toBe('bottom')
    expect(panel.querySelector('[data-scroll-region]')?.textContent).toBe('Pick a level.')
    key('Escape')
    expect(onclose).toHaveBeenCalledOnce()
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    expect(document.activeElement).toBe(opener)
  })
})
