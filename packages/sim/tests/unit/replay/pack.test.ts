import { expect, test } from 'vitest'
import { encodeReplay } from '#src/replay/codec'
import { ReplayFormatError } from '#src/replay/errors'
import { packReplay, REPLAY_INFLATE_MAX_BYTES, type ReplayCompression, unpackReplay } from '#src/replay/pack'
import type { Replay } from '#src/replay/replay'

/** "Deflate" is a marker byte in front; inflate honours the cap the way the real adapters do. */
function fakeCompression(log: number[] = []): ReplayCompression {
  return {
    deflate: async (bytes) => Uint8Array.from([0xde, ...bytes]),
    inflate: async (bytes, maxBytes) => {
      log.push(maxBytes)
      if (bytes[0] !== 0xde) throw new Error('invalid block type')
      if (bytes.length - 1 > maxBytes) throw new ReplayFormatError(`inflates past ${maxBytes} bytes`)
      return bytes.slice(1)
    },
  }
}

const replay: Replay = {
  header: {
    tickHz: 60,
    seed: 1,
    schemaHash: '0000000000000001',
    contentHash: '0000000000000002',
    startTick: 0,
    checkEvery: 60,
    framework: '0.0.0',
    meta: {},
  },
  start: Uint8Array.of(1, 2, 3),
  ticks: [{ tick: 0, commands: [{ source: 0, seq: 1, type: 'go', payload: { x: 1 } }] }],
  checks: [],
  finalTick: 1,
  finalHash: '0000000000000003',
}

test('pack deflates the encoded bytes; unpack inverts it with the default 8 MiB cap', async () => {
  const log: number[] = []
  const packed = await packReplay(replay, fakeCompression(log))
  expect(packed).toEqual(Uint8Array.from([0xde, ...encodeReplay(replay)]))
  expect(await unpackReplay(packed, fakeCompression(log))).toEqual(replay)
  expect(log).toEqual([REPLAY_INFLATE_MAX_BYTES])
  expect(REPLAY_INFLATE_MAX_BYTES).toBe(8 * 1024 * 1024)
})

test('a lower cap is passed through, and passing it is a ReplayFormatError', async () => {
  const packed = await packReplay(replay, fakeCompression())
  await expect(unpackReplay(packed, fakeCompression(), { maxInflatedBytes: 10 })).rejects.toThrow(
    /inflates past 10 bytes/,
  )
})

test('an adapter that ignores the cap is still caught', async () => {
  const careless: ReplayCompression = { ...fakeCompression(), inflate: async (b) => b.slice(1) }
  const packed = await packReplay(replay, careless)
  const err = await unpackReplay(packed, careless, { maxInflatedBytes: 10 }).catch((e: unknown) => e)
  expect(err).toBeInstanceOf(ReplayFormatError)
  expect((err as Error).message).toMatch(/inflates past 10 bytes/)
})

test('input that is not deflate is a ReplayFormatError', async () => {
  const err = await unpackReplay(Uint8Array.of(1, 2, 3), fakeCompression()).catch((e: unknown) => e)
  expect(err).toBeInstanceOf(ReplayFormatError)
  expect((err as Error).message).toMatch(/not a deflated replay/)
})
