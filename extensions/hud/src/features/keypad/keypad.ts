// The keypad's code, apart from the drawing: digits typed so far, never more than the code has, and a display that shows
// what is typed and the places left.

/** `code` with `digit` added, unless it is already `length` long. */
export const typeDigit = (code: string, digit: string, length: number): string =>
  /^[0-9]$/.test(digit) && code.length < length ? code + digit : code

/** `code` without its last digit. */
export const deleteDigit = (code: string): string => code.slice(0, -1)

/** Enter works once the code is whole. */
export const canEnter = (code: string, length: number): boolean => code.length === length

/** The digits typed and an underscore for each place left: `42__`. */
export const display = (code: string, length: number): string =>
  code + '_'.repeat(Math.max(0, length - code.length))
