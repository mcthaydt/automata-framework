import { expect, test } from 'vitest'
import { ReplayFormatError } from './errors'
import { readVarint, writeVarint } from './varint'

const encode = (value: number): number[] => {
  const out: number[] = []
  writeVarint(out, value)
  return out
}

test.each([0, 1, 127, 128, 300, 16383, 16384, 4294967295])('%i round-trips', (value) => {
  const bytes = Uint8Array.from([0xaa, ...encode(value), 0xbb])
  expect(readVarint(bytes, 1)).toEqual({ value, next: bytes.length - 1 })
})

test('unsigned LEB128, at most five bytes', () => {
  expect(encode(0)).toEqual([0])
  expect(encode(127)).toEqual([0x7f])
  expect(encode(128)).toEqual([0x80, 0x01])
  expect(encode(4294967295)).toEqual([0xff, 0xff, 0xff, 0xff, 0x0f])
})

test('writing a value outside 0..2^32-1 or not an integer throws', () => {
  expect(() => encode(-1)).toThrow(RangeError)
  expect(() => encode(4294967296)).toThrow(RangeError)
  expect(() => encode(1.5)).toThrow(RangeError)
})

function formatError(bytes: number[], offset = 0): ReplayFormatError {
  try {
    readVarint(Uint8Array.from(bytes), offset)
  } catch (err) {
    expect(err).toBeInstanceOf(ReplayFormatError)
    return err as ReplayFormatError
  }
  throw new Error('expected a ReplayFormatError')
}

test('a sixth continuation byte is a format error naming the offset', () => {
  const err = formatError([0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01], 1)
  expect(err.offset).toBe(1)
  expect(err.message).toMatch(/varint.*5 bytes/)
})

test('a value over 2^32-1 is a format error', () => {
  expect(formatError([0xff, 0xff, 0xff, 0xff, 0x10]).message).toMatch(/2\^32/)
})

test('a truncated varint is a format error', () => {
  const err = formatError([0x80, 0x80], 0)
  expect(err.message).toMatch(/truncated/)
  expect(err.offset).toBe(2)
})
