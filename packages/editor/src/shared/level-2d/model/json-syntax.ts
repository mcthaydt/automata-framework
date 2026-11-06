// Where a text stops being JSON. `JSON.parse` names a position only in some engines (V8 and Firefox do, Safari does
// not), and the error panel needs a line and a column in all of them, so this reads RFC 8259
// itself. It is only consulted after `JSON.parse` has thrown, to locate the first error; a property test keeps it in
// agreement with `JSON.parse` about which texts are valid. (`kit/documents/json/locate.ts` is the other scanner on
// purpose: it builds the tree of values with their spans and fails with its own error, while this one only words the
// first problem.)

export interface JsonError {
  readonly message: string
  /** Index of the first character that does not belong, or the text's length when it ends too soon. */
  readonly offset: number
  /** From 1. */
  readonly line: number
  /** From 1, in UTF-16 code units. */
  readonly column: number
}

/** Deeper than any project file goes; a bound so a hostile `[[[[…` cannot overflow the stack. */
const MAX_DEPTH = 512

class Stop {
  readonly message: string
  readonly offset: number
  constructor(message: string, offset: number) {
    this.message = message
    this.offset = offset
  }
}

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9'
const isHex = (ch: string | undefined): boolean => ch !== undefined && /^[0-9a-fA-F]$/.test(ch)

function scan(text: string): void {
  let i = 0
  const fail = (message: string, at: number = i): never => {
    throw new Stop(message, at)
  }
  /** The text ended: that is the problem, whatever was expected. Otherwise `message` at the current character. */
  const reject = (message: string): never =>
    i >= text.length ? fail('Unexpected end of input') : fail(message)
  const skipSpace = (): void => {
    while (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r') i++
  }
  const unexpected = (): never => reject(`Unexpected character ${JSON.stringify(text[i])}`)

  function literal(word: string): void {
    for (let k = 0; k < word.length; k++) {
      if (text[i + k] !== word[k]) {
        i += k
        unexpected()
      }
    }
    i += word.length
  }

  function digits(message: string): void {
    if (!isDigit(text[i])) fail(message)
    while (isDigit(text[i])) i++
  }

  function number(): void {
    if (text[i] === '-') i++
    if (text[i] === '0') {
      i++
      if (isDigit(text[i])) fail('Bad number: a leading 0 cannot be followed by digits')
    } else {
      digits('Bad number: expected a digit')
    }
    if (text[i] === '.') {
      i++
      digits('Bad number: expected a digit after "."')
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++
      if (text[i] === '+' || text[i] === '-') i++
      digits('Bad number: expected a digit in the exponent')
    }
  }

  function string(): void {
    i++ // the opening quote
    for (;;) {
      if (i >= text.length) fail('Unexpected end of input in a string')
      const code = text.charCodeAt(i)
      if (code === 0x22) {
        i++
        return
      }
      if (code < 0x20) fail('Control character in a string; write it as an escape')
      if (code !== 0x5c) {
        i++
        continue
      }
      i++ // the backslash
      const after = text[i]
      if (after === 'u') {
        i++
        for (let k = 0; k < 4; k++) {
          if (!isHex(text[i + k])) fail('Bad escape: \\u needs four hex digits', i + k)
        }
        i += 4
      } else if (after !== undefined && '"\\/bfnrt'.includes(after)) {
        i++
      } else {
        reject('Bad escape in a string')
      }
    }
  }

  function object(depth: number): void {
    i++
    skipSpace()
    if (text[i] === '}') {
      i++
      return
    }
    for (;;) {
      skipSpace()
      if (text[i] !== '"') reject('Expected a string key')
      string()
      skipSpace()
      if (text[i] !== ':') reject('Expected ":"')
      i++
      value(depth + 1)
      skipSpace()
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === '}') {
        i++
        return
      }
      reject('Expected "," or "}"')
    }
  }

  function array(depth: number): void {
    i++
    skipSpace()
    if (text[i] === ']') {
      i++
      return
    }
    for (;;) {
      value(depth + 1)
      skipSpace()
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === ']') {
        i++
        return
      }
      reject('Expected "," or "]"')
    }
  }

  function value(depth: number): void {
    if (depth > MAX_DEPTH) fail(`Nested more than ${MAX_DEPTH} levels deep`)
    skipSpace()
    const ch = text[i]
    if (ch === '{') object(depth)
    else if (ch === '[') array(depth)
    else if (ch === '"') string()
    else if (ch === '-' || isDigit(ch)) number()
    else if (ch === 't') literal('true')
    else if (ch === 'f') literal('false')
    else if (ch === 'n') literal('null')
    else unexpected()
  }

  value(0)
  skipSpace()
  if (i < text.length) fail('Unexpected content after the value')
}

/** The first error in `text` as JSON, with its line and column, or `undefined` when `JSON.parse` would accept it. */
export function findJsonError(text: string): JsonError | undefined {
  try {
    scan(text)
    return undefined
  } catch (error) {
    if (!(error instanceof Stop)) throw error
    let line = 1
    let lineStart = 0
    for (let k = 0; k < error.offset; k++) {
      if (text[k] === '\n') {
        line++
        lineStart = k + 1
      }
    }
    return { message: error.message, offset: error.offset, line, column: error.offset - lineStart + 1 }
  }
}
