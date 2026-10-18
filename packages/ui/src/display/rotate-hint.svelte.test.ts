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
})
