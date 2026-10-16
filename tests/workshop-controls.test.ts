import { describe, expect, it } from 'vitest'
import { createInputDevices } from '../../automata-framework/examples/base-2d/src/input/devices'
import { isolateControlKeys } from '../workshop/controls'

describe('Native workshop controls', () => {
  it('preserves native key defaults while keeping control keydowns out of the game', () => {
    const controls = document.createElement('header')
    controls.innerHTML = '<input type="range"><button>Original</button>'
    document.body.appendChild(controls)
    const input = createInputDevices({ target: window, touchButtons: [], onPause() {}, onAnyInput() {} })
    const release = isolateControlKeys(controls)
    try {
      for (const [element, code] of [[controls.querySelector('input')!, 'ArrowRight'], [controls.querySelector('button')!, 'Space']] as const) {
        const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true })
        element.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
        expect(input.held().right).toBe(false)
        expect(input.held().jump).toBe(false)
      }
      // A key held before focus enters the controls must still release normally.
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', cancelable: true }))
      expect(input.held().right).toBe(true)
      controls.querySelector('input')!.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }))
      expect(input.held().right).toBe(false)
    } finally { release(); input.dispose(); controls.remove() }
  })
})
