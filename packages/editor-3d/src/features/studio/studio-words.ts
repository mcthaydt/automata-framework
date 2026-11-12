/**
 * An id as it is written in a figure's file (`wick-shadow`, `wanderer`) in words a person reads (`Wick shadow`,
 * `Wanderer`). The id stays the value that is saved; only the label shown changes.
 */
export function idWords(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').trim()
  return words === '' ? id : words.charAt(0).toUpperCase() + words.slice(1)
}
