// Unsigned LEB128 of at most five bytes, for values 0..2^32-1. Arithmetic rather than shifts
// past bit 30, since JS bit operators work on signed 32-bit integers.
import { ReplayFormatError } from './errors'

const MAX_U32 = 4294967295

export function writeVarint(out: number[], value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_U32)
    throw new RangeError(`varint: ${value} is not an integer in 0..2^32-1`)
  let rest = value
  while (rest >= 0x80) {
    out.push((rest % 0x80) | 0x80)
    rest = Math.floor(rest / 0x80)
  }
  out.push(rest)
}

/** Reads a varint at `offset`; `next` is the offset just after it. */
export function readVarint(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0
  let scale = 1
  for (let i = 0; i < 5; i++) {
    const at = offset + i
    const byte = bytes[at]
    if (byte === undefined) throw new ReplayFormatError('truncated varint', at)
    value += (byte & 0x7f) * scale
    if ((byte & 0x80) === 0) {
      if (value > MAX_U32) throw new ReplayFormatError('varint over 2^32-1', offset)
      return { value, next: at + 1 }
    }
    scale *= 0x80
  }
  throw new ReplayFormatError('varint longer than 5 bytes', offset)
}
