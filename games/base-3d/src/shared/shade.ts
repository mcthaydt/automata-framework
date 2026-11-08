// Dimming a colour: used by the scene (a room's sky and ground) and the time of day that decides how much.

/** `colour` with each channel scaled by `shade` (0 to 1). */
export function shadeColour(colour: number, shade: number): number {
  const channel = (shift: number): number => Math.round(((colour >> shift) & 0xff) * shade)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}
