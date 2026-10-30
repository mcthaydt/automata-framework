import { formatJsonNumber, JsonWriteError } from '../json/print'

// How a new scalar is written into the span of the TOML literal it replaces (editor suite spec §4.4). Numbers follow
// the kit's one rule (`formatJsonNumber`: no exponent, float noise trimmed to four decimals), and the literal keeps
// what it can of how it was written, so the type a schema reads does not flip and the file's quoting stays.

export type TomlScalar = string | number | bigint | boolean

/** A TOML float literal: a fraction or an exponent (not in a hex, octal or binary integer), `inf` or `nan`. */
const isFloatLiteral = (raw: string): boolean =>
  /^[+-]?(?:inf|nan)$/.test(raw) || (!/^[+-]?0[xob]/.test(raw) && /[.eE]/.test(raw))

/** A one-line literal string (`'…'`): no escapes, so it can hold any text but `'`, a line break or a control. */
const isLiteralString = (raw: string): boolean => raw.startsWith("'") && !raw.startsWith("'''")

// biome-ignore lint/suspicious/noControlCharactersInRegex: the controls are exactly what a literal string cannot hold.
const LITERAL_STRING_UNSAFE = /['\u0000-\u0008\u000a-\u001f\u007f]/

const ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '"': '\\"',
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
}

/** A basic string (`"…"`) with the escapes TOML requires: `\`, `"`, every control character and U+007F. */
function basicString(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what must be escaped.
  const escaped = text.replace(/[\\"\u0000-\u001f\u007f]/g, (character) => {
    const named = ESCAPES[character]
    if (named !== undefined) return named
    return `\\u${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
  })
  return `"${escaped}"`
}

/**
 * The literal text for `value`, given the raw text of the literal it replaces (`undefined` for a new one). A float
 * literal stays a float (`356.0` set to 357 is `357.0`); an integer given a fraction becomes a float; a literal string
 * stays one when the new text allows it, and anything else is a one-line basic string. Throws `JsonWriteError` for a
 * number that cannot be written that way (not finite, or too large to write without an exponent).
 */
export function writeTomlScalar(value: TomlScalar, replacing: string | undefined): string {
  switch (typeof value) {
    case 'number': {
      const text = formatJsonNumber(value)
      return replacing !== undefined && isFloatLiteral(replacing) && !text.includes('.') ? `${text}.0` : text
    }
    case 'bigint':
      return String(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'string':
      return replacing !== undefined && isLiteralString(replacing) && !LITERAL_STRING_UNSAFE.test(value)
        ? `'${value}'`
        : basicString(value)
    default:
      throw new JsonWriteError(`${String(value)} is not a TOML scalar`)
  }
}
