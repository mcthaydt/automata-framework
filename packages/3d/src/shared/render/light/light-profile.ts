// The numbers that set how a room is lit, in one place: the key on the normal, the fill's fade, how a lamp's strength and the
// sum's cap and steps are set, and what a room's shade multiplies by. A game's `worldLighting` takes them; the time of day
// gives the ambient, fill and sun on top. Values are starting values, tuned here by looking at screenshots.

export const LIGHT_PROFILE = {
  /** The longest triangle edge (metres) a baked piece is cut to. */
  seg: 0.35,
  /** The small key on the normal, added to the ambient: its direction (as given, not normalised) and strength. */
  key: { dir: [0.3, 0.8, 0.5], level: 0.09 },
  /** The fill's fade with height over the floor: `[start, metres per fade, least]`. */
  fillFade: [1.5, 4, 0.25],
  /** A lamp at level 1 is this many times its colour; the sum is capped at `max` a channel and comes in steps of `step`. */
  light: { step: 0.1, strength: 2.6, max: 1.6 },
  /** What one whole step of a room's shade multiplies its light by. */
  shade: 0.85,
  /** The camera's pitch (degrees) the sun's direction is taken at, from the time's key in view space. */
  pitch: 18,
} as const
