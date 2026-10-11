// `.replay` bytes before deflate (M2.3 spec §3.3), little-endian through DataView:
//   "AFRP" | format u16 | headerLength u32 | header: canonical JSON (ReplayHeader + commandTypes) UTF-8
//   start      length u32 | snapshot bytes
//   ticks      count varint | per tick: delta varint (first from startTick, then from the previous tick, >= 1)
//              | commands varint (>= 1) | per command: source u8 | seq varint | type index varint
//              | payload length varint | payload: canonical JSON UTF-8
//   checks     count varint | per check: delta varint (from startTick, then the previous check; >= 1) | hash u64
//   final      delta varint (finalTick - startTick) | hash u64
//   reference  0 | 1, then hash u64 x (finalTick - startTick) | snapshots varint
//              | per snapshot: delta varint (as checks) | length u32 | bytes
// Payloads are canonical JSON, so the same run encodes to the same bytes in every engine.
import { z } from 'zod'
import { canonicalJson, decodeUtf8Strict, utf8 } from '../hash/canonical'
import { ReplayFormatError } from './errors'
import { REPLAY_FORMAT, type Replay, type ReplayCommand, type ReplayHeader } from './replay'
import { readVarint, writeVarint } from './varint'

const MAGIC = [0x41, 0x46, 0x52, 0x50] // "AFRP"
const HASH_RE = /^[0-9a-f]{16}$/
const u32 = z.number().int().min(0).max(4294967295)
const HeaderSchema = z.strictObject({
  tickHz: z.number().int().min(1).max(1000),
  seed: u32,
  schemaHash: z.string().regex(HASH_RE),
  contentHash: z.string().regex(HASH_RE),
  startTick: u32,
  checkEvery: z.number().int().min(1).max(4294967295),
  framework: z.string(),
  meta: z.record(z.string(), z.string()),
  commandTypes: z.array(z.string()),
})

class ByteWriter {
  private buf = new Uint8Array(1024)
  private view = new DataView(this.buf.buffer)
  length = 0
  /** Reserves `n` bytes and returns their offset. It may replace buf and view, so callers call it first. */
  private room(n: number): number {
    if (this.length + n > this.buf.length) {
      let size = this.buf.length * 2
      while (size < this.length + n) size *= 2
      const next = new Uint8Array(size)
      next.set(this.buf.subarray(0, this.length))
      this.buf = next
      this.view = new DataView(next.buffer)
    }
    const at = this.length
    this.length += n
    return at
  }
  u8(v: number): void {
    const at = this.room(1)
    this.view.setUint8(at, v)
  }
  u16(v: number): void {
    const at = this.room(2)
    this.view.setUint16(at, v, true)
  }
  u32(v: number): void {
    const at = this.room(4)
    this.view.setUint32(at, v, true)
  }
  hash(hex: string): void {
    const at = this.room(8)
    this.view.setBigUint64(at, BigInt(`0x${hex}`), true)
  }
  varint(v: number): void {
    const out: number[] = []
    writeVarint(out, v)
    for (const b of out) this.u8(b)
  }
  bytes(b: Uint8Array): void {
    const at = this.room(b.length)
    this.buf.set(b, at)
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.length)
  }
}

class ByteReader {
  private readonly view: DataView
  pos = 0
  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  private need(n: number): number {
    if (this.pos + n > this.buf.length) throw new ReplayFormatError('truncated', this.buf.length)
    const at = this.pos
    this.pos += n
    return at
  }
  u8(): number {
    return this.view.getUint8(this.need(1))
  }
  u16(): number {
    return this.view.getUint16(this.need(2), true)
  }
  u32(): number {
    return this.view.getUint32(this.need(4), true)
  }
  hash(): string {
    return this.view.getBigUint64(this.need(8), true).toString(16).padStart(16, '0')
  }
  varint(): number {
    const { value, next } = readVarint(this.buf, this.pos)
    this.pos = next
    return value
  }
  /** A varint that must be at least `min`; `what` names it in the error. */
  atLeast(min: number, what: string): number {
    const at = this.pos
    const v = this.varint()
    if (v < min) throw new ReplayFormatError(`${what} ${v}, expected at least ${min}`, at)
    return v
  }
  take(n: number): Uint8Array {
    const at = this.need(n)
    return this.buf.subarray(at, at + n)
  }
  text(n: number, what: string): string {
    const at = this.pos
    const bytes = this.take(n)
    try {
      return decodeUtf8Strict(bytes)
    } catch (err) {
      throw new ReplayFormatError(`${what} is not valid UTF-8`, at, { cause: err })
    }
  }
}

const fail = (message: string): never => {
  throw new ReplayFormatError(message)
}

/** Checks what the type system cannot: everything the byte layout needs to hold the value exactly. */
function checkEncodable(replay: Replay): void {
  const { header, finalTick } = replay
  const parsed = HeaderSchema.safeParse({ ...header, commandTypes: [] })
  if (!parsed.success) fail(`invalid header: ${parsed.error.message}`)
  if (!HASH_RE.test(replay.finalHash)) fail(`final hash "${replay.finalHash}" is not 16 hex digits`)
  if (!Number.isInteger(finalTick) || finalTick < header.startTick || finalTick > 4294967295)
    fail(`finalTick ${finalTick} is before startTick ${header.startTick}`)
  let last = -1
  for (const { tick, commands } of replay.ticks) {
    if (!Number.isInteger(tick) || tick <= last || tick < header.startTick || tick >= finalTick)
      fail(`tick ${tick} is out of order or outside [startTick, finalTick)`)
    if (commands.length === 0) fail(`tick ${tick} has no commands`)
    for (const c of commands)
      if (!Number.isInteger(c.source) || c.source < 0 || c.source > 255)
        fail(`command source ${c.source} is not a u8`)
    last = tick
  }
  const inRange = (what: string, items: ReadonlyArray<{ tick: number }>): void => {
    let previous = header.startTick
    for (const { tick } of items) {
      if (!Number.isInteger(tick) || tick <= previous || tick > finalTick)
        fail(`${what} at tick ${tick} is out of order or outside (startTick, finalTick]`)
      previous = tick
    }
  }
  inRange('check', replay.checks)
  for (const { hash } of replay.checks)
    if (!HASH_RE.test(hash)) fail(`check hash "${hash}" is not 16 hex digits`)
  if (replay.reference) {
    const expected = finalTick - header.startTick
    if (replay.reference.hashes.length !== expected)
      fail(`expected ${expected} reference hashes, got ${replay.reference.hashes.length}`)
    for (const hash of replay.reference.hashes)
      if (!HASH_RE.test(hash)) fail(`reference hash "${hash}" is not 16 hex digits`)
    inRange('reference snapshot', replay.reference.snapshots)
  }
}

export function encodeReplay(replay: Replay): Uint8Array {
  checkEncodable(replay)
  const { header } = replay
  const types = new Set<string>()
  for (const t of replay.ticks) for (const c of t.commands) types.add(c.type)
  const commandTypes = [...types].sort()
  const typeIndex = new Map(commandTypes.map((t, i) => [t, i]))

  const out = new ByteWriter()
  for (const b of MAGIC) out.u8(b)
  out.u16(REPLAY_FORMAT)
  const headerBytes = utf8(canonicalJson({ ...header, commandTypes }))
  out.u32(headerBytes.length)
  out.bytes(headerBytes)
  out.u32(replay.start.length)
  out.bytes(replay.start)

  out.varint(replay.ticks.length)
  let previous = header.startTick
  for (const { tick, commands } of replay.ticks) {
    out.varint(tick - previous)
    previous = tick
    out.varint(commands.length)
    for (const c of commands) {
      out.u8(c.source)
      out.varint(c.seq)
      out.varint(typeIndex.get(c.type) as number)
      const payload = utf8(canonicalJson(c.payload))
      out.varint(payload.length)
      out.bytes(payload)
    }
  }

  out.varint(replay.checks.length)
  previous = header.startTick
  for (const { tick, hash } of replay.checks) {
    out.varint(tick - previous)
    previous = tick
    out.hash(hash)
  }
  out.varint(replay.finalTick - header.startTick)
  out.hash(replay.finalHash)

  if (!replay.reference) out.u8(0)
  else {
    out.u8(1)
    for (const hash of replay.reference.hashes) out.hash(hash)
    out.varint(replay.reference.snapshots.length)
    previous = header.startTick
    for (const { tick, bytes } of replay.reference.snapshots) {
      out.varint(tick - previous)
      previous = tick
      out.u32(bytes.length)
      out.bytes(bytes)
    }
  }
  return out.done()
}

export function decodeReplay(bytes: Uint8Array): Replay {
  const rd = new ByteReader(bytes)
  for (const b of MAGIC) if (rd.u8() !== b) throw new ReplayFormatError('bad magic (not an AFRP replay)', 0)
  const format = rd.u16()
  if (format !== REPLAY_FORMAT) throw new ReplayFormatError(`unsupported format ${format}`, 4)
  const headerAt = rd.pos
  const headerText = rd.text(rd.u32(), 'header')
  let headerJson: unknown
  try {
    headerJson = JSON.parse(headerText)
  } catch (err) {
    throw new ReplayFormatError('header is not JSON', headerAt, { cause: err })
  }
  const parsed = HeaderSchema.safeParse(headerJson)
  if (!parsed.success) throw new ReplayFormatError(`invalid header: ${parsed.error.message}`, headerAt)
  const { commandTypes, ...header } = parsed.data satisfies ReplayHeader & { commandTypes: string[] }
  const start = rd.take(rd.u32()).slice()

  const ticks: Array<{ tick: number; commands: ReplayCommand[] }> = []
  let previous = header.startTick
  for (let n = rd.varint(); n > 0; n--) {
    const tick = previous + rd.atLeast(ticks.length === 0 ? 0 : 1, 'tick delta')
    previous = tick
    const commands: ReplayCommand[] = []
    for (let m = rd.atLeast(1, 'command count'); m > 0; m--) {
      const source = rd.u8()
      const seq = rd.varint()
      const typeAt = rd.pos
      const typeIndex = rd.varint()
      const type = commandTypes[typeIndex]
      if (type === undefined) throw new ReplayFormatError(`type index ${typeIndex} out of range`, typeAt)
      const payloadAt = rd.pos
      const text = rd.text(rd.varint(), 'payload')
      let payload: unknown
      try {
        payload = JSON.parse(text)
      } catch (err) {
        throw new ReplayFormatError('payload is not JSON', payloadAt, { cause: err })
      }
      commands.push({ source, seq, type, payload })
    }
    ticks.push({ tick, commands })
  }

  const checks: Array<{ tick: number; hash: string; at: number }> = []
  previous = header.startTick
  for (let n = rd.varint(); n > 0; n--) {
    const at = rd.pos
    previous += rd.atLeast(1, 'check delta')
    checks.push({ tick: previous, hash: rd.hash(), at })
  }
  const finalTick = header.startTick + rd.varint()
  const finalHash = rd.hash()
  for (const c of checks)
    if (c.tick > finalTick)
      throw new ReplayFormatError(
        `check at tick ${c.tick} is outside (startTick, finalTick ${finalTick}]`,
        c.at,
      )
  const lastTick = ticks[ticks.length - 1]
  if (lastTick && lastTick.tick >= finalTick)
    throw new ReplayFormatError(`commands at tick ${lastTick.tick}, at or past finalTick ${finalTick}`)

  const replay = {
    header,
    start,
    ticks,
    checks: checks.map(({ tick, hash }) => ({ tick, hash })),
    finalTick,
    finalHash,
  }
  const flagAt = rd.pos
  const flag = rd.u8()
  if (flag === 0) {
    if (rd.pos !== bytes.length) throw new ReplayFormatError('trailing bytes', rd.pos)
    return replay
  }
  if (flag !== 1) throw new ReplayFormatError(`reference flag ${flag}, expected 0 or 1`, flagAt)
  const hashes: string[] = []
  for (let i = header.startTick; i < finalTick; i++) hashes.push(rd.hash())
  const snapshots: Array<{ tick: number; bytes: Uint8Array }> = []
  previous = header.startTick
  for (let n = rd.varint(); n > 0; n--) {
    const at = rd.pos
    previous += rd.atLeast(1, 'reference snapshot delta')
    if (previous > finalTick)
      throw new ReplayFormatError(`reference snapshot at tick ${previous} is past finalTick ${finalTick}`, at)
    snapshots.push({ tick: previous, bytes: rd.take(rd.u32()).slice() })
  }
  if (rd.pos !== bytes.length) throw new ReplayFormatError('trailing bytes', rd.pos)
  return { ...replay, reference: { hashes, snapshots } }
}
