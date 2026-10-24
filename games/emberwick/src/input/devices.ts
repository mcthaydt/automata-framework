import { type Action, actionForKey, type Held, NOTHING_HELD } from './keys.ts'

// Listens to the keyboard and the on-screen touch buttons and reports what is held. Pause is an action, not a
// held state: it fires once per key press. Everything is released when the window loses focus, so a key held
// while switching tabs does not stay "down".

export interface InputDevices {
  held(): Held
  dispose(): void
}

export interface DeviceOptions {
  readonly target: Window
  /** Elements with data-hold="left" | "right" | "jump". */
  readonly touchButtons: readonly HTMLElement[]
  readonly onPause: () => void
  /** Any key or tap at all (the splash screen continues on it). */
  readonly onAnyInput: () => void
}

export function createInputDevices(options: DeviceOptions): InputDevices {
  const keys = new Set<Exclude<Action, 'pause'>>()
  const touches = new Set<Exclude<Action, 'pause'>>()
  const cleanups: Array<() => void> = []
  const listen = <K extends keyof WindowEventMap>(type: K, fn: (event: WindowEventMap[K]) => void) => {
    options.target.addEventListener(type, fn)
    cleanups.push(() => options.target.removeEventListener(type, fn))
  }

  listen('keydown', (event) => {
    options.onAnyInput()
    const action = actionForKey(event.code)
    if (action === undefined) return
    // Keep Space and the arrows from scrolling the page, but leave Enter and Tab to the buttons.
    if (action !== 'pause' || event.code === 'Escape') event.preventDefault()
    if (action === 'pause') {
      if (!event.repeat) options.onPause()
    } else {
      keys.add(action)
    }
  })
  listen('keyup', (event) => {
    const action = actionForKey(event.code)
    if (action !== undefined && action !== 'pause') keys.delete(action)
  })
  listen('pointerdown', () => options.onAnyInput())
  listen('blur', () => {
    keys.clear()
    touches.clear()
  })

  for (const button of options.touchButtons) {
    const action = button.dataset.hold
    if (action !== 'left' && action !== 'right' && action !== 'jump') continue
    const press = (event: PointerEvent) => {
      event.preventDefault()
      // Keep receiving this pointer's events if the finger slides off the button. A synthetic event has no
      // active pointer to capture, which is fine: the button still works without capture.
      try {
        button.setPointerCapture(event.pointerId)
      } catch {}
      touches.add(action)
      button.dataset.held = 'true'
    }
    const release = () => {
      touches.delete(action)
      delete button.dataset.held
    }
    button.addEventListener('pointerdown', press)
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    button.addEventListener('lostpointercapture', release)
    cleanups.push(() => {
      button.removeEventListener('pointerdown', press)
      button.removeEventListener('pointerup', release)
      button.removeEventListener('pointercancel', release)
      button.removeEventListener('lostpointercapture', release)
    })
  }

  return {
    held() {
      if (keys.size === 0 && touches.size === 0) return NOTHING_HELD
      const down = (action: Exclude<Action, 'pause'>) => keys.has(action) || touches.has(action)
      return { left: down('left'), right: down('right'), jump: down('jump') }
    },
    dispose() {
      for (const cleanup of cleanups) cleanup()
    },
  }
}
