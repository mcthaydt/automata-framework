/**
 * How long one step may take once play draws: the headless shell draws WebGL2 in software, a frame or more a
 * second (Emberwick's journeys measured up to 3.8 s a frame on a loaded machine, ROOM_STEP_MS there).
 */
export const PLAY_STEP_MS = 40_000

/**
 * How long a whole journey may take. Playwright's default is 30 s, shorter than one step above, and on a loaded
 * runner a journey is dozens of page round trips of a second each: the portrait journey (G3-x) took 31 to 33 s and was
 * cut off just as play came back. A journey that is stuck still fails at its own step's timeout, so this only
 * stops a slow machine being called a failure.
 */
export const JOURNEY_TIMEOUT_MS = 3 * PLAY_STEP_MS
