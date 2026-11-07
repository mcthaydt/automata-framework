// @vitest-environment node
import { packReplay, type Replay, ReplayFormatError, unpackReplay } from '@automata/sim/replay'
import { expect, test } from 'vitest'
import { nodeCompression, streamCompression } from '#src/testing/compression.ts'

// Node has CompressionStream too, so both adapters run here; the browsers run streamCompression in sim-browsers.
const adapters = { node: nodeCompression, stream: streamCompression } as const

const big = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 7919) % 251)

test.each([
  ['node', 'stream'],
  ['stream', 'node'],
  ['node', 'node'],
  ['stream', 'stream'],
] as const)('%s deflate is read back by %s inflate', async (from, to) => {
  const bytes = big(100_000)
  const packed = await adapters[from].deflate(bytes)
  expect(packed.length).toBeLessThan(bytes.length)
  expect(await adapters[to].inflate(packed, bytes.length)).toEqual(bytes)
})

test.each(['node', 'stream'] as const)('%s inflate stops at the cap', async (name) => {
  const packed = await adapters[name].deflate(new Uint8Array(1_000_000)) // zeros: a tiny "bomb"
  const err = await adapters[name].inflate(packed, 4096).catch((e: unknown) => e)
  expect(err).toBeInstanceOf(ReplayFormatError)
  expect((err as Error).message).toMatch(/inflates past 4096 bytes/)
})

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

test.each(['node', 'stream'] as const)(
  '%s: a packed replay unpacks; garbage is a ReplayFormatError',
  async (name) => {
    const packed = await packReplay(replay, adapters[name])
    expect(await unpackReplay(packed, adapters[name])).toEqual(replay)
    const err = await unpackReplay(Uint8Array.of(0xff, 0xff, 0xff, 0xff), adapters[name]).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ReplayFormatError)
  },
)
