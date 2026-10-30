import type { RaceTuning } from '../sim/tuning.schema'

// Placeholder content (PRODUCT spec §3: the race's numbers are the game's). These values are the starter's own, in
// metres, chosen so the climb works without FloorFifty's wall-riding margin: one bounce rises 2.34 m against a
// 1.8 m gap, and a fast fall moves 0.25 m a tick at 60 Hz, under the 0.4 m floor, so no floor is passed in one tick.

export const PLACEHOLDER_TUNING: RaceTuning = {
  viewportWidth: 19.2,
  floorCount: 8,
  lapCount: 2,
  floorWidth: 2.4,
  floorHeight: 0.4,
  floorGap: 1.8,
  racerWidth: 1,
  racerHeight: 1,
  gravity: -12,
  bounceVelocity: 7.5,
  moveSpeed: 6,
  fastFallVelocity: -15,
  movingSpeedMin: 1.5,
  movingSpeedMax: 3,
  deathLineMargin: 5,
  lapHoldTicks: 30,
  movingFloorCarry: 1,
}

/** The course seed the scripted race and the examples use. */
export const PLACEHOLDER_COURSE_SEED = 20261030
