import { expect, test } from 'vitest'
import { decodeReplay, encodeReplay } from '#src/features/replay/codec.ts'
import { ReplayFormatError } from '#src/features/replay/errors.ts'
import { REPLAY_MAX_TICKS, type Replay } from '#src/features/replay/replay.ts'
import { canonicalJson, utf8 } from '#src/shared/hash/canonical.ts'

const H = (n: number): string => n.toString(16).padStart(16, '0')

function replay(over: Partial<Replay> = {}): Replay {
  return {
    header: {
      tickHz: 60,
      seed: 7,
      schemaHash: H(0xaa),
      contentHash: H(0xbb),
      startTick: 10,
      checkEvery: 2,
      framework: '0.0.0',
      meta: {},
    },
    start: Uint8Array.of(1, 2, 3),
    ticks: [
      { tick: 10, commands: [{ source: 0, seq: 1, type: 'move', payload: { dx: 1 } }] },
      {
        tick: 12,
        commands: [
          { source: 0, seq: 2, type: 'jump', payload: null },
          { source: 1, seq: 1, type: 'move', payload: { dx: -1 } },
        ],
      },
    ],
    checks: [
      { tick: 12, hash: H(0x12) },
      { tick: 13, hash: H(0x13) },
    ],
    finalTick: 13,
    finalHash: H(0x13),
    ...over,
  }
}

const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
const le32 = (n: number): string =>
  hex(Uint8Array.of(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255))
const le64 = (n: number): string => `${le32(n)}00000000`
const text = (s: string): string => hex(utf8(s))

test('the bytes of a small three-tick replay, laid out by hand from spec §3.3', () => {
  const header =
    '{"checkEvery":2,"commandTypes":["jump","move"],"contentHash":"00000000000000bb","framework":"0.0.0",' +
    '"meta":{},"schemaHash":"00000000000000aa","seed":7,"startTick":10,"tickHz":60}'
  const expected = [
    '41465250', // "AFRP"
    '0100', // format 1
    le32(header.length),
    text(header),
    le32(3), // start length
    '010203',
    '02', // two ticks with commands
    '00', // tick 10: delta 0 from startTick
    '01', // one command
    '00', // source 0
    '01', // seq 1
    '01', // type index 1: "move"
    '08', // payload length
    text('{"dx":1}'),
    '02', // tick 12: delta 2
    '02', // two commands
    '00',
    '02',
    '00',
    '04',
    text('null'), // source 0, seq 2, "jump"
    '01',
    '01',
    '01',
    '09',
    text('{"dx":-1}'), // source 1, seq 1, "move"
    '02', // two checks
    '02',
    le64(0x12), // tick 12
    '01',
    le64(0x13), // tick 13
    '03',
    le64(0x13), // final: tick 13
    '00', // no reference
  ].join('')
  expect(hex(encodeReplay(replay()))).toBe(expected)
})

const roundTrip = (r: Replay): Replay => decodeReplay(encodeReplay(r))

test('round trips: the small replay', () => {
  expect(roundTrip(replay())).toEqual(replay())
})

test('round trips: an empty run (no ticks, no checks, finalTick = startTick)', () => {
  const r = replay({ ticks: [], checks: [], finalTick: 10, finalHash: H(1) })
  expect(roundTrip(r)).toEqual(r)
})

test('round trips: one tick', () => {
  const r = replay({ ticks: [], checks: [{ tick: 11, hash: H(2) }], finalTick: 11, finalHash: H(2) })
  expect(roundTrip(r)).toEqual(r)
})

test('round trips: commands on non-consecutive ticks, many sources, large values and unicode', () => {
  const commands = Array.from({ length: 40 }, (_, i) => ({
    source: i * 6,
    seq: 4294967295 - i,
    type: i % 2 ? 'a.b' : 'zz',
    payload: { s: 'Ünï 😀', n: -0.5, list: [i, null, true] },
  }))
  const r = replay({
    header: { ...replay().header, startTick: 0, checkEvery: 70001, meta: { game: 'g', build: '1' } },
    ticks: [
      { tick: 0, commands },
      { tick: 1000, commands: commands.slice(0, 3) },
      { tick: 70000, commands: commands.slice(5, 6) },
    ],
    checks: [{ tick: 70001, hash: 'ffffffffffffffff' }],
    finalTick: 70001,
    finalHash: 'ffffffffffffffff',
  })
  expect(roundTrip(r)).toEqual(r)
})

test('round trips: reference hashes and snapshots', () => {
  const r = replay({
    reference: {
      hashes: [H(11), H(12), H(13)],
      snapshots: [
        { tick: 12, bytes: Uint8Array.of(9, 9) },
        { tick: 13, bytes: Uint8Array.of(8) },
      ],
    },
  })
  expect(roundTrip(r)).toEqual(r)
})

// --- one test per format error (spec §5) ---

function decodeError(bytes: Uint8Array): ReplayFormatError {
  try {
    decodeReplay(bytes)
  } catch (err) {
    expect(err).toBeInstanceOf(ReplayFormatError)
    return err as ReplayFormatError
  }
  throw new Error('expected a ReplayFormatError')
}

/** The small replay's bytes with `edit` applied; offsets come from the layout test above. */
function edited(edit: (b: number[]) => void, r: Replay = replay()): Uint8Array {
  const b = [...encodeReplay(r)]
  edit(b)
  return Uint8Array.from(b)
}
const headerEnd = (r: Replay = replay()): number => {
  const b = encodeReplay(r)
  return 10 + new DataView(b.buffer).getUint32(6, true)
}
/** Offset of the ticks section: after the header and the 3-byte start snapshot. */
const ticksAt = (): number => headerEnd() + 4 + 3

test('bad magic', () => {
  expect(decodeError(edited((b) => (b[0] = 0x42))).message).toMatch(/magic/)
})

test('unknown format version', () => {
  expect(decodeError(edited((b) => (b[4] = 2))).message).toMatch(/format 2/)
})

test('truncated', () => {
  const bytes = encodeReplay(replay())
  for (const cut of [3, 8, 20, ticksAt() + 2, bytes.length - 1]) {
    expect(decodeError(bytes.subarray(0, cut)).message).toMatch(/truncated/)
  }
})

test('trailing bytes', () => {
  expect(decodeError(edited((b) => b.push(0))).message).toMatch(/trailing/)
})

test('a varint over 5 bytes', () => {
  const err = decodeError(edited((b) => b.splice(ticksAt(), 1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x00)))
  expect(err.message).toMatch(/5 bytes/)
  expect(err.offset).toBe(ticksAt())
})

test('a delta of 0 where at least 1 is required', () => {
  // The second tick's delta (2) becomes 0: the same tick twice.
  const err = decodeError(edited((b) => (b[ticksAt() + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 8] = 0)))
  expect(err.message).toMatch(/delta 0/)
})

test('a type index out of range', () => {
  const err = decodeError(edited((b) => (b[ticksAt() + 5] = 2)))
  expect(err.message).toMatch(/type index 2/)
})

test('a payload that is not JSON', () => {
  // '{"dx":1}' becomes '{"dx":1('
  const err = decodeError(edited((b) => (b[ticksAt() + 7 + 7] = 0x28)))
  expect(err.message).toMatch(/payload/)
})

test('a payload that is not UTF-8', () => {
  const err = decodeError(edited((b) => (b[ticksAt() + 7 + 1] = 0xff)))
  expect(err.message).toMatch(/UTF-8/)
})

test('a check outside (startTick, finalTick]', () => {
  const r = replay()
  const bytes = encodeReplay(r)
  // The final delta (3) becomes 2, so the check at tick 13 lies past finalTick 12.
  const finalAt = bytes.length - 1 - 8 - 1
  expect(bytes[finalAt]).toBe(3)
  expect(decodeError(edited((b) => (b[finalAt] = 2))).message).toMatch(/check at tick 13/)
})

test('a reference hash count that does not match', () => {
  const r = replay({ reference: { hashes: [H(11), H(12), H(13)], snapshots: [] } })
  // One hash short: the decoder reads the snapshot count from the third hash's bytes and runs out.
  const bytes = encodeReplay(r)
  const short = Uint8Array.from([...bytes.subarray(0, bytes.length - 1 - 8), 0])
  expect(() => decodeReplay(short)).toThrow(ReplayFormatError)
  expect(() => encodeReplay(replay({ reference: { hashes: [H(11)], snapshots: [] } }))).toThrow(
    /3 reference hashes/,
  )
})

test('a header that is not a replay header', () => {
  const r = replay()
  const json = canonicalJson({ ...r.header, commandTypes: ['jump', 'move'], tickHz: 'fast' })
  const bytes = edited((b) => b.splice(10, headerEnd() - 10, ...utf8(json)))
  const view = new DataView(bytes.buffer)
  view.setUint32(6, utf8(json).length, true)
  expect(decodeError(bytes).message).toMatch(/header/)
})

test('encoding refuses a value the format cannot hold', () => {
  expect(() => encodeReplay(replay({ ticks: [{ tick: 10, commands: [] }] }))).toThrow(ReplayFormatError)
  expect(() =>
    encodeReplay(
      replay({ ticks: [{ tick: 10, commands: [{ source: 256, seq: 1, type: 'm', payload: 1 }] }] }),
    ),
  ).toThrow(ReplayFormatError)
  expect(() => encodeReplay(replay({ checks: [{ tick: 10, hash: H(1) }] }))).toThrow(ReplayFormatError)
  expect(() => encodeReplay(replay({ finalHash: 'xyz' }))).toThrow(ReplayFormatError)
})

/** An empty run whose final delta varint is replaced, to claim a longer run than the bytes hold. */
function emptyRunEndingAt(delta: number, checkEvery: number): Uint8Array {
  const r = replay({
    header: { ...replay().header, checkEvery },
    ticks: [],
    checks: [],
    finalTick: 10,
    finalHash: H(1),
  })
  const b = [...encodeReplay(r)]
  const finalAt = b.length - 1 - 8 - 1
  const varint: number[] = []
  for (let v = delta; ; v = Math.floor(v / 128)) {
    if (v < 128) {
      varint.push(v)
      break
    }
    varint.push((v % 128) | 128)
  }
  b.splice(finalAt, 1, ...varint)
  return Uint8Array.from(b)
}

test('a run longer than REPLAY_MAX_TICKS', () => {
  expect(REPLAY_MAX_TICKS).toBe(16_777_216) // 2^24
  expect(decodeReplay(emptyRunEndingAt(REPLAY_MAX_TICKS, 4294967295)).finalTick).toBe(10 + REPLAY_MAX_TICKS)
  expect(decodeError(emptyRunEndingAt(REPLAY_MAX_TICKS + 1, 4294967295)).message).toMatch(/longer than/)
  expect(decodeError(emptyRunEndingAt(4294967295 - 10, 4294967295)).message).toMatch(/longer than/)
  const long = replay({
    header: { ...replay().header, checkEvery: 4294967295 },
    ticks: [],
    checks: [],
    finalTick: 11 + REPLAY_MAX_TICKS,
    finalHash: H(1),
  })
  expect(() => encodeReplay(long)).toThrow(/longer than/)
})

test('more than checkEvery ticks without a check', () => {
  // checkEvery 2: the final hash at tick 13 is three ticks after the start, with no check between.
  expect(decodeError(emptyRunEndingAt(3, 2)).message).toMatch(/3 ticks without a check \(checkEvery 2\)/)
  expect(decodeReplay(emptyRunEndingAt(2, 2)).finalTick).toBe(12)
  expect(() => encodeReplay(replay({ checks: [{ tick: 13, hash: H(0x13) }] }))).toThrow(/without a check/)
})
