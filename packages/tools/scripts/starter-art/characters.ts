import { blank, type Picture, plot, stamp } from './png.ts'
import { PALETTE } from './palette.ts'

// The three starter characters, each a strip of equal frames the character's animation cuts: the player (16 x 24, the
// size of the player start, so what is drawn is what collides), a coin (8 x 8) and a slime (16 x 12).

/** Rows of `inner`, each centred in a frame `width` wide with transparent sides. */
const centred = (width: number, inner: readonly string[]): string[] =>
  inner.map((row) => {
    const pad = (width - row.length) / 2
    if (!Number.isInteger(pad)) throw new Error(`"${row}" cannot be centred in ${width}.`)
    return `${'.'.repeat(pad)}${row}${'.'.repeat(pad)}`
  })

const PLAYER_BODY = [
  'kkkkkkkk',
  'khhhhhhhhk',
  'khhhhhhhhhhk',
  'khhhhhhhhhhk',
  'khhsssssshhk',
  'kssssssssssk',
  'kssksssskssk',
  'ksssssSSsssk',
  'kssssssssk',
  'kssk',
  'kggggggggggk',
  'kggggggggggk',
  'kggggggggGGk',
  'kggggggggGGk',
  'kggggggggGGk',
  'ksggggggggsk',
  'kBBBBBBBBBBk',
  'kbbbbkkbbbbk',
  'kbbbbkkbbbbk',
  'kbbbbkkbbbbk',
  'kBBBBkkBBBBk',
  'khhhhkkhhhhk',
  'kkkkkkkkkkkk',
]

/** Eyes shut: the one change a blink makes. */
const BLINK_ROW = 'kssSsssssSsk'

/** The player: standing, then blinking. 32 x 24. */
export function playerSheet(): Picture {
  const sheet = blank(32, 24)
  const open = centred(16, PLAYER_BODY)
  const shut = open.map((row, index) => (index === 6 ? centred(16, [BLINK_ROW])[0] : row))
  stamp(sheet, 0, 1, open, PALETTE)
  stamp(sheet, 16, 1, shut, PALETTE)
  return sheet
}

/** The coin turning: face on, tilting, edge on, tilting back. 32 x 8. */
export function coinSheet(): Picture {
  const sheet = blank(32, 8)
  const halfWidths = [3.5, 2.5, 1, 2.5]
  halfWidths.forEach((half, frame) => {
    for (let y = 0; y < 8; y += 1)
      for (let x = 0; x < 8; x += 1) {
        const dx = (x - 3.5) / half
        const dy = (y - 3.5) / 3.5
        const inside = dx * dx + dy * dy <= 1.05
        if (!inside) continue
        const rim = (Math.abs(dx) > 0.7 || Math.abs(dy) > 0.75) && half > 1.5
        // A shine in the upper left of a coin turned toward the player.
        const shine = half > 3 && x <= 2 && y <= 2 && x + y <= 3
        plot(sheet, frame * 8 + x, y, shine ? PALETTE.l! : rim || half <= 1.5 ? PALETTE.Y! : PALETTE.y!)
      }
  })
  return sheet
}

/** The slime: relaxed, then stretched taller. 32 x 12. */
export function slimeSheet(): Picture {
  const sheet = blank(32, 12)
  const shapes = [
    { half: 7.5, top: 3 },
    { half: 6.5, top: 1 },
  ]
  shapes.forEach(({ half, top }, frame) => {
    const height = 12 - top
    for (let y = top; y < 12; y += 1)
      for (let x = 0; x < 16; x += 1) {
        const dx = (x - 7.5) / half
        const dy = (y - 11.5) / (height - 0.5)
        // A dome that is flat on the ground.
        if (dx * dx + dy * dy > 1) continue
        const edge = (x - 7.5) ** 2 / half ** 2 + dy * dy > 0.72 || y === 11
        plot(sheet, frame * 16 + x, y, edge ? PALETTE.M! : PALETTE.m!)
      }
    const eyes = top + 4
    for (const x of [5, 10]) {
      plot(sheet, frame * 16 + x, eyes, PALETTE.w!)
      plot(sheet, frame * 16 + x, eyes + 1, PALETTE.k!)
    }
    plot(sheet, frame * 16 + 4, top + 2, PALETTE.p!)
    plot(sheet, frame * 16 + 5, top + 1, PALETTE.p!)
  })
  return sheet
}
