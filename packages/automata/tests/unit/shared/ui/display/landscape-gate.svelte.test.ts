import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LandscapeGateState } from '#src/shared/ui/browser/landscape-gate.ts'
import type { LandscapeGateCopy } from '#src/shared/ui/display/display-copy.ts'
import LandscapeGate from '#src/shared/ui/display/LandscapeGate.svelte'

// The landscape gate's cover (M4 spec §4.9, §7):
// empty while the gate is open; one tap, on the button that has focus, to go fullscreen; or, where the browser
// cannot hide its bar, how to play.

const copy: LandscapeGateCopy = {
  title: 'Play fullscreen',
  body: 'Your browser’s bar takes too much of the screen sideways.',
  go: 'Go fullscreen',
  uprightTitle: 'Turn your phone upright',
  uprightBody: 'Or add the game to your Home Screen to play sideways.',
}

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(state: LandscapeGateState) {
  const onfullscreen = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(LandscapeGate, { target: host, props: { state, copy, onfullscreen } })
  flushSync()
  return { host, onfullscreen, gate: () => host.querySelector<HTMLElement>('[data-testid="landscape-gate"]') }
}

describe('LandscapeGate', () => {
  it('draws nothing while the gate is open', () => {
    expect(open('none').gate()).toBeNull()
  })

  it('asks for one tap to go fullscreen, on the button that has focus', () => {
    const { gate, onfullscreen } = open('fullscreen')
    const dialog = gate()?.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.textContent).toContain('Play fullscreen')
    const button = gate()?.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-fullscreen"]')
    expect(document.activeElement).toBe(button)
    expect(button?.dataset.kind).toBe('primary')
    button?.click()
    expect(onfullscreen).toHaveBeenCalledOnce()
  })

  it('says how to play where the browser cannot hide its bar, with nothing to press', () => {
    const { gate } = open('rotate-or-install')
    expect(gate()?.dataset.gate).toBe('rotate-or-install')
    expect(gate()?.textContent).toContain('Turn your phone upright')
    expect(gate()?.querySelector('button')).toBeNull()
  })
})
