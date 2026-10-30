// The `xx-long` pseudo-locale (PRODUCT spec §4 item 7): English with every letter swapped for an accented
// look-alike, 40% longer, between ⟦ ⟧ brackets. A game makes its `xx-long` catalog from its source catalog with
// `pseudoMessages`, for test builds only; ui's layout contracts run every primitive in it. Two things come out:
//
//  - The extra length and the brackets show truncated, clipped or concatenated text, which is what a longer
//    language (German and French run 30% to 40% longer than English) would do to the layout.
//  - A screen whose words all come through the catalog shows no plain ASCII words, so a plain word left on a
//    screen is a string that skipped the catalog (`hasRawText`).
//
// Extracted from Ruken packages/localization/src/pseudo.ts (d0fa2fe), Ruken's own `en-XA` pseudo-locale.
// Changed from Ruken: the tag is `xx-long` and the text 40% longer (35% there), as the PRODUCT spec sets them.

/** The pseudo-locale's tag. `Intl` reads it as the unknown language `xx`, so formatting falls back, never throws. */
export const PSEUDO_LOCALE = 'xx-long'

// cspell:disable-next-line
const LOWER = 'áƀçđéƒĝĥíĵķĺḿñóƥɋŕšŧúṽŵẋýž'
// cspell:disable-next-line
const UPPER = 'ÁƁÇĐÉƑĜĤÍĴĶĹḾÑÓƤɊŔŠŦÚṼŴẊÝŽ'

const OPEN = '⟦'
const CLOSE = '⟧'
const FILLER = '·'
/** How much longer than the English the text is made: the most a translation may add and still fit. */
const EXTRA_LENGTH = 0.4

/** An escaped brace (`\{`, `\}`) or a `{placeholder}`: the parts of a message that are not words. */
const NOT_WORDS = /(\\[{}]|\{[^{}]*\})/

function accent(text: string): string {
  return text.replace(/[A-Za-z]/g, (letter) =>
    letter <= 'Z'
      ? (UPPER[letter.charCodeAt(0) - 65] ?? letter)
      : (LOWER[letter.charCodeAt(0) - 97] ?? letter),
  )
}

/** The xx-long form of one message string. Placeholders and escaped braces stay as written. */
export function pseudoLocalize(message: string): string {
  if (message === '') return ''
  const accented = message
    .split(NOT_WORDS)
    .map((part, index) => (index % 2 === 1 ? part : accent(part))) // odd parts are the NOT_WORDS matches
    .join('')
  const padding = FILLER.repeat(Math.ceil(message.length * EXTRA_LENGTH))
  return `${OPEN}${accented}${padding}${CLOSE}`
}

/** A value in an inlang message file: a message, a list of variants, or a namespace or variant object. */
export type MessageValue = string | readonly MessageValue[] | { readonly [key: string]: MessageValue }

/**
 * The xx-long form of a whole message file (the inlang message format): nested namespaces are walked, plural
 * variants keep their `declarations` and `selectors` (they are code, not text) and only their `match` texts
 * change. `$schema` is copied as is.
 */
export function pseudoMessages(file: { readonly [key: string]: MessageValue }): Record<string, MessageValue> {
  const convert = (value: MessageValue, key: string): MessageValue => {
    if (typeof value === 'string') return key === '$schema' ? value : pseudoLocalize(value)
    if (Array.isArray(value)) return value.map((item) => convert(item as MessageValue, key))
    const out: Record<string, MessageValue> = {}
    for (const [name, child] of Object.entries(value as { readonly [key: string]: MessageValue })) {
      out[name] = name === 'declarations' || name === 'selectors' ? child : convert(child, name)
    }
    return out
  }
  return convert(file, '') as Record<string, MessageValue>
}

/**
 * True when a piece of visible text has English in it that did not come from the xx-long catalog: any ASCII
 * letter outside a ⟦ ⟧ span. Data a player typed (a name) is also "raw", so a check lists the data it expects.
 */
export function hasRawText(text: string): boolean {
  return /[A-Za-z]/.test(text.replace(/⟦[^⟧]*⟧/g, ''))
}
