// Endesga 64 by Endesga (lospec.com/palette-list/endesga-64), the Owner's palette for AF (docs/art/README.md).
// The same 64 colors in the same order as docs/art/palettes/endesga-64.txt; art.test.ts checks it against the file.
// Stand-in until the palette is content (M1.3) and theme tokens (M1.6).

export const ENDESGA_64: readonly string[] = [
  '#ff0040',
  '#131313',
  '#1b1b1b',
  '#272727',
  '#3d3d3d',
  '#5d5d5d',
  '#858585',
  '#b4b4b4', // 0–7
  '#ffffff',
  '#c7cfdd',
  '#92a1b9',
  '#657392',
  '#424c6e',
  '#2a2f4e',
  '#1a1932',
  '#0e071b', // 8–15
  '#1c121c',
  '#391f21',
  '#5d2c28',
  '#8a4836',
  '#bf6f4a',
  '#e69c69',
  '#f6ca9f',
  '#f9e6cf', // 16–23
  '#edab50',
  '#e07438',
  '#c64524',
  '#8e251d',
  '#ff5000',
  '#ed7614',
  '#ffa214',
  '#ffc825', // 24–31
  '#ffeb57',
  '#d3fc7e',
  '#99e65f',
  '#5ac54f',
  '#33984b',
  '#1e6f50',
  '#134c4c',
  '#0c2e44', // 32–39
  '#00396d',
  '#0069aa',
  '#0098dc',
  '#00cdf9',
  '#0cf1ff',
  '#94fdff',
  '#fdd2ed',
  '#f389f5', // 40–47
  '#db3ffd',
  '#7a09fa',
  '#3003d9',
  '#0c0293',
  '#03193f',
  '#3b1443',
  '#622461',
  '#93388f', // 48–55
  '#ca52c9',
  '#c85086',
  '#f68187',
  '#f5555d',
  '#ea323c',
  '#c42430',
  '#891e2b',
  '#571c27', // 56–63
]

/** A color by its index in the palette file (0–63). */
export function endesga(index: number): string {
  const color = ENDESGA_64[index]
  if (color === undefined) throw new Error(`Endesga 64 has no color ${index}`)
  return color
}
