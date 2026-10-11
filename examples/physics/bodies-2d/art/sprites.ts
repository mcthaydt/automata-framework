// The demo's two bodies as palette-indexed pixel maps, in base-2d's format (`PixelSprite`: each character is a
// key into the sprite's palette, `.` is transparent) and its Emberwick look: colored outlines, no black, a
// highlight on the top left where the moon is. Both are 8 × 8, the size of the bodies at 16 pixels a metre
// (a crate is half a metre; a stone, 0.44 m across, fills the box with its outline). Endesga 64 only, checked by
// art.test.ts. Provenance: PROVENANCE.md.
import type { PixelSprite } from '@af-examples/base-2d'

function sprite(palette: Readonly<Record<string, string>>, rows: readonly string[]): PixelSprite {
  return { width: rows[0]?.length ?? 0, height: rows.length, palette, rows }
}

/** A wooden crate with a band of moss on its lid and one diagonal brace. */
export const CRATE: PixelSprite = sprite(
  {
    O: '#391f21', // outline (Endesga 17)
    M: '#99e65f', // moss, lit (34)
    m: '#33984b', // moss (36)
    l: '#bf6f4a', // wood, lit (20)
    w: '#8a4836', // wood (19)
    s: '#5d2c28', // wood, shade (18)
  },
  ['.OOOOOO.', 'OMmMMmMO', 'OlmwwmsO', 'OwlwwwsO', 'OwwlwwsO', 'OwwwlwsO', 'OssssssO', '.OOOOOO.'],
)

/** A stone of lantern glass: cyan, lit from the top left, darker toward the bottom right. */
export const STONE: PixelSprite = sprite(
  {
    O: '#03193f', // outline (52)
    L: '#94fdff', // highlight (45)
    c: '#00cdf9', // glass (43)
    s: '#0098dc', // glass, shade (42)
  },
  ['..OOOO..', '.OLLccO.', 'OLLcccsO', 'OLccccsO', 'OccccssO', 'OcccsssO', '.OcsssO.', '..OOOO..'],
)

export const BODY_SPRITES: Readonly<Record<string, PixelSprite>> = { CRATE, STONE }
