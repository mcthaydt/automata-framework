// What a pad held when it changed hands, kept from acting until let go. Input moves between play and menus on Play, pause
// and Resume, and the press that caused the move is usually still down: a held confirm must not press the new
// screen's first button. Each held button and stick direction is masked on its own, so a held A never blocks a
// fresh lean of the stick.
import { DEADZONE, type PadLike, TRIGGER_PRESSED } from './read-pad.js'

export class HandoverMask {
  private index: number | undefined
  private readonly buttons = new Set<number>()
  /** Axis index and sign, as `"1+"`: a stick direction beyond the deadzone. */
  private readonly axes = new Set<string>()

  capture(pad: PadLike): void {
    this.clear()
    this.index = pad.index
    pad.buttons.forEach((button, index) => {
      if (button.pressed || button.value >= TRIGGER_PRESSED) this.buttons.add(index)
    })
    pad.axes.forEach((value, index) => {
      if (value >= DEADZONE) this.axes.add(`${index}+`)
      if (value <= -DEADZONE) this.axes.add(`${index}-`)
    })
  }

  clear(): void {
    this.index = undefined
    this.buttons.clear()
    this.axes.clear()
  }

  /** The pad with masked inputs read as released; forgets whatever was let go. */
  apply(pad: PadLike): PadLike {
    if (this.index !== pad.index) return pad
    for (const index of [...this.buttons]) {
      const button = pad.buttons[index]
      if (button === undefined || (!button.pressed && button.value < TRIGGER_PRESSED))
        this.buttons.delete(index)
    }
    for (const key of [...this.axes]) {
      const value = pad.axes[Number(key.slice(0, -1))] ?? 0
      const held = key.endsWith('+') ? value >= DEADZONE : value <= -DEADZONE
      if (!held) this.axes.delete(key)
    }
    if (this.buttons.size === 0 && this.axes.size === 0) return pad
    return {
      ...pad,
      buttons: pad.buttons.map((button, index) =>
        this.buttons.has(index) ? { pressed: false, value: 0 } : button,
      ),
      axes: pad.axes.map((value, index) =>
        this.axes.has(`${index}+`) || this.axes.has(`${index}-`) ? 0 : value,
      ),
    }
  }
}
