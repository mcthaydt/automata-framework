import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import type { RotateHintCopy } from './display-copy'
import RotateHint from './RotateHint.svelte'

// The rotate hint (M4 spec §4.9, §7): over a game locked to one orientation, held the other way on a phone, while
// the game is paused. Not interactive: turning the phone is the only way past it.

const copy: RotateHintCopy = { title: 'Turn your phone', body: 'This game plays in landscape.' }

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(shown: boolean) {
  const props = $state({ shown, copy })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(RotateHint, { target: host, props })
  flushSync()
  return { props, hint: () => host.querySelector<HTMLElement>('[data-testid="rotate-hint"]') }
}

describe('RotateHint', () => {
  it('shows its words while shown, and goes when the phone is turned', () => {
    const { props, hint } = open(true)
    expect(hint()?.textContent).toContain('Turn your phone')
    expect(hint()?.textContent).toContain('This game plays in landscape.')
    props.shown = false
    flushSync()
    expect(hint()).toBeNull()
  })

  it('has nothing to press or focus', () => {
    const { hint } = open(true)
    expect(hint()?.querySelector('button, a[href], input, [tabindex]')).toBeNull()
  })

  it('sets its words on a panel, as the landscape gate does, so the screen under the scrim never shows through them', () => {
    const { hint } = open(true)
    const panel = hint()?.querySelector('.af-rotate-hint__panel')
    expect(panel?.textContent).toContain('Turn your phone')
    expect(panel?.textContent).toContain('This game plays in landscape.')
  })

  it('gives the focus back where it was once the phone is turned back', () => {
    const control = document.body.appendChild(document.createElement('button'))
    control.focus()
    const { props } = open(false)
    props.shown = true
    flushSync()
    // A browser drops the focus from a control made inert; jsdom does not, so the test drops it as the browser does.
    control.blur()
    props.shown = false
    flushSync()
    expect(document.activeElement).toBe(control)
  })

  it('leaves the focus alone if it moved while shown, or its control has gone', () => {
    const control = document.body.appendChild(document.createElement('button'))
    const other = document.body.appendChild(document.createElement('button'))
    control.focus()
    const { props } = open(false)
    props.shown = true
    flushSync()
    other.focus()
    props.shown = false
    flushSync()
    expect(document.activeElement).toBe(other)
    control.focus()
    props.shown = true
    flushSync()
    control.remove()
    props.shown = false
    flushSync()
    expect(document.activeElement).toBe(document.body)
  })
})
