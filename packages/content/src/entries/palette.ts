// @automata/content/palette: AF's default palette for a game's page, browser-safe. The compiler checks a
// game's own palette; this entry serves the default, DUEL, and the helpers for its 32 ramps of 8.
export {
  DUEL_RAMP_NAMES,
  DUEL_RAMPS,
  type DuelRampName,
  duelIndex,
  nearestDuel,
  rampOf,
  step,
} from '../shared/palette/duel'
export { DEFAULT_PALETTE, type Palette } from '../shared/palette/palette'
