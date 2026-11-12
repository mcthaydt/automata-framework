// The clock of the kit's moving passes (stars, rain, particles, shafts): seconds that grow with the ticker, and hold still while
// the player has asked for less movement. The setting is read at each tick, as it can change while the game is open.

/** A clock a ticker drives: `tick` takes the frame's milliseconds and returns the seconds so far. */
export interface PassClock {
  tick(deltaMs: number): number
}

/** `reduced` says whether the player asked for less movement; while it does, the clock stands where it was. */
export function passClock(reduced: () => boolean): PassClock {
  let seconds = 0
  return {
    tick(deltaMs) {
      if (!reduced()) seconds += deltaMs / 1000
      return seconds
    },
  }
}
