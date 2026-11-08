// The iPads the editors' journeys run at: iPad 11" in landscape and portrait,
// iPad mini and iPad 13". A journey sets the window with `page.viewport(width, height)`.

export interface IpadProfile {
  readonly name: string
  readonly width: number
  readonly height: number
}

export const IPAD_PROFILES: readonly IpadProfile[] = [
  { name: 'ipad-pro-11-landscape', width: 1194, height: 834 },
  { name: 'ipad-pro-11-portrait', width: 834, height: 1194 },
  { name: 'ipad-mini-landscape', width: 1133, height: 744 },
  { name: 'ipad-pro-13-landscape', width: 1366, height: 1024 },
]

/** The same iPad turned a quarter round: what EK-c sets the window to mid-gesture. */
export const turned = (profile: IpadProfile): IpadProfile => ({
  name: `${profile.name} turned`,
  width: profile.height,
  height: profile.width,
})
