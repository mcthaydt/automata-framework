// The integer hash behind auto-tile chance and variants and the random dice (2D editor spec §5.6). It uses only
// `Math.imul`, shifts and xor on 32-bit integers, so every engine computes the same bits and a project exports the same
// tiles in Node, Chromium, WebKit and Firefox (spec G-d). A float anywhere here would break that.

/** Which question a hash answers, so the chance roll and the variant pick of one cell are unrelated. */
export const SALT = { chance: 1, variant: 2, dice: 3 } as const

const rotateLeft = (value: number, bits: number): number => (value << bits) | (value >>> (32 - bits))

/** One 32-bit word folded into the running state: the body of murmur3_32's loop. */
function foldWord(state: number, word: number): number {
  let k = Math.imul(word, 0xcc9e2d51)
  k = rotateLeft(k, 15)
  k = Math.imul(k, 0x1b873593)
  const mixed = rotateLeft(state ^ k, 13)
  return (Math.imul(mixed, 5) + 0xe6546b64) | 0
}

/**
 * murmur3_32 of the four words `key, x, y, salt` under `seed`; an unsigned 32-bit integer. `seed` is the auto layer's
 * stored seed, `key` is `hashText` of the rule's id (or 0 for the dice), (x, y) the cell.
 */
export function hashCell(seed: number, key: number, x: number, y: number, salt: number): number {
  let h = seed | 0
  h = foldWord(h, key | 0)
  h = foldWord(h, x | 0)
  h = foldWord(h, y | 0)
  h = foldWord(h, salt | 0)
  h ^= 16 // the input is 16 bytes long
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** FNV-1a over the UTF-16 code units (rule ids are ASCII, where this is the usual byte-wise FNV-1a); unsigned. */
export function hashText(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
