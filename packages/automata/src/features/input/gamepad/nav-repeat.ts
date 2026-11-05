// The held-direction repeat for menus, from FloorFifty `gamepad-source.ts` at `ac72660`
// (lines 35–36 and `fireNav`): a held direction fires at once, again after a delay, then steadily, as a held key
// does. Buttons never repeat, so only directions come here.
import type { PadDirection } from './read-pad.js'

export const REPEAT_DELAY_MS = 400
export const REPEAT_EVERY_MS = 120

export class NavRepeat {
  private readonly held = new Map<PadDirection, { since: number; lastFired: number }>()

  /** The directions to fire on this poll, given what is held now. */
  update(current: ReadonlySet<PadDirection>, nowMs: number): PadDirection[] {
    for (const direction of [...this.held.keys()]) if (!current.has(direction)) this.held.delete(direction)
    const fired: PadDirection[] = []
    for (const direction of current) {
      const held = this.held.get(direction)
      if (held === undefined) {
        this.held.set(direction, { since: nowMs, lastFired: nowMs })
        fired.push(direction)
        continue
      }
      const due =
        held.lastFired === held.since
          ? nowMs - held.since >= REPEAT_DELAY_MS
          : nowMs - held.lastFired >= REPEAT_EVERY_MS
      if (due) {
        held.lastFired = nowMs
        fired.push(direction)
      }
    }
    return fired
  }

  clear(): void {
    this.held.clear()
  }
}
