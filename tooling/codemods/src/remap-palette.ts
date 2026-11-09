// Remaps the colours of an old palette to DUEL, for a palette pull: `remapPalette(['#ff0040', ...])` answers each
// colour's nearest DUEL index (OKLab), in order. Run on hex colours, it prints the table to read before the art is
// rewritten by hand:
//
//   node --import ./packages/3d/scripts/extensionless-ts.ts tooling/codemods/src/remap-palette.ts '#ff0040' '#131313'
//
// (`@automata/content` writes its imports without `.ts`, which that hook lets Node load.)
import { DEFAULT_PALETTE, nearestDuel } from '@automata/content/palette'

/** Each colour's nearest DUEL palette index, in the order given; a colour that is not `#rrggbb` is refused by name. */
export function remapPalette(fromHex: readonly string[]): number[] {
  return fromHex.map((hex) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`expected a colour like #ff0040, got "${hex}"`)
    return nearestDuel(hex)
  })
}

/** One line per colour: the old colour, its DUEL index and the DUEL colour. */
export function remapTable(fromHex: readonly string[]): string {
  return remapPalette(fromHex)
    .map((index, n) => `${fromHex[n]?.toLowerCase()} -> ${index} ${DEFAULT_PALETTE.colors[index]}\n`)
    .join('')
}

if (import.meta.main) process.stdout.write(remapTable(process.argv.slice(2)))
