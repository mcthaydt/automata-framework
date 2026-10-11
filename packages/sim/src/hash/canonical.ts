import { sortedKeys } from '../util/sorted'

/** A value canonical JSON cannot represent exactly; hashing it anyway would let different values collide. */
export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(`canonicalJson: ${message}`)
    this.name = 'CanonicalJsonError'
  }
}

/** Only arrays and plain objects (prototype Object.prototype or null) have a canonical form. */
function describeNonPlain(value: object): string | undefined {
  if (Array.isArray(value)) return undefined
  const proto = Object.getPrototypeOf(value)
  if (proto === Object.prototype || proto === null) return undefined
  // "[object Date]" -> "Date"; a class instance reports "Object", so it gets a description instead.
  const tag = Object.prototype.toString.call(value).slice(8, -1)
  return tag === 'Object' ? 'class instance' : tag
}

/**
 * Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
 * Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
 * Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
 * functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
 * serialize as {} and hash the same as every other one; M2.1 spec §10.7).
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false'
    case 'string':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalJsonError(`non-finite number ${value}`)
      // JSON.stringify(-0) is "0", which would turn -0 into 0 on restore; "-0" parses back to -0.
      return Object.is(value, -0) ? '-0' : JSON.stringify(value)
    case 'object': {
      const nonPlain = describeNonPlain(value)
      if (nonPlain) throw new CanonicalJsonError(`unsupported ${nonPlain}; convert it to plain data first`)
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
      const obj = value as Record<string, unknown>
      return `{${sortedKeys(obj)
        .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
        .join(',')}}`
    }
    default:
      throw new CanonicalJsonError(`unsupported ${typeof value}`)
  }
}

/** UTF-8 encoding without TextEncoder (the sim's lib has no DOM/Web APIs). Lone surrogates become U+FFFD. */
export function utf8(s: string): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1)
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00)
        i++
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return Uint8Array.from(out)
}
