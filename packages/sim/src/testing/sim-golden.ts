// simGolden: A0+A1's light pin (M2.3 spec §3.6). It records the sim's hash every `every` ticks into a JSON file
// that reads well in a PR diff, and reports the first recorded tick that differs. For the fields behind a
// difference, use replayGolden.
import {
  type Command,
  canonicalJson,
  createRng,
  createSim,
  deriveSeed,
  type PluginDef,
  type Rng,
  type Sim,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { fileName, readGoldenFile, resolveGoldenPath, updatingGoldens, writeGoldenFile } from './golden-files'
import type { GoldenReport } from './report'

/**
 * What `simGolden` runs: the plugins, content, seed and scripted commands to play for `ticks` ticks, where
 * the golden JSON lives, and how often to record a hash.
 */
export interface SimGoldenOptions {
  readonly name: string
  /** The golden is <dir>/__goldens__/<name>.golden.json; a relative dir is taken from the test file's folder. */
  readonly dir: string
  readonly plugins: readonly PluginDef[]
  readonly content?: unknown
  readonly seed: number
  readonly tickHz?: number
  readonly setup?: (sim: Sim) => void
  /** Commands for each tick; `rng` is a stream of its own, derived from the seed. */
  readonly script: (tick: number, rng: Rng) => readonly Command[]
  readonly ticks: number
  /** Record a hash every this many ticks (default 1). */
  readonly every?: number
}

interface SimGoldenFile {
  readonly name: string
  readonly seed: number
  readonly tickHz: number
  readonly ticks: number
  readonly every: number
  readonly schemaHash: string
  readonly contentHash: string
  readonly hashes: ReadonlyArray<{ readonly tick: number; readonly hash: string }>
}

const hex16 = z.string().regex(/^[0-9a-f]{16}$/)
const tick = z.number().int().min(0)
const SimGoldenFileSchema = z.object({
  name: z.string(),
  seed: z.number().int(),
  tickHz: z.number().int(),
  ticks: z.number().int(),
  every: z.number().int(),
  schemaHash: hex16,
  contentHash: hex16,
  hashes: z.array(z.object({ tick, hash: hex16 })),
})

/** A golden that is not JSON or not this shape is a broken file, not a difference in the run. */
function parseGoldenFile(name: string, bytes: Uint8Array): SimGoldenFile {
  let json: unknown
  try {
    json = JSON.parse(new TextDecoder().decode(bytes))
  } catch (err) {
    throw new Error(`simGolden: ${name} is not a simGolden file (not JSON)`, { cause: err })
  }
  const parsed = SimGoldenFileSchema.safeParse(json)
  if (!parsed.success) throw new Error(`simGolden: ${name} is not a simGolden file: ${parsed.error.message}`)
  return parsed.data
}

const SETUP_FIELDS = ['seed', 'tickHz', 'ticks', 'every'] as const

/**
 * Canonical JSON per value (sorted keys), laid out one field per line and one hash per line, so a re-pin reads
 * as a diff of the ticks that moved.
 */
function toFileText(golden: SimGoldenFile): string {
  const { hashes, ...fields } = golden
  const lines = Object.keys({ ...fields, hashes })
    .sort()
    .map((key) =>
      key === 'hashes'
        ? `  "hashes": [\n${hashes.map((h) => `    ${canonicalJson(h)}`).join(',\n')}\n  ]`
        : `  ${JSON.stringify(key)}: ${canonicalJson(fields[key as keyof typeof fields])}`,
    )
  return `{\n${lines.join(',\n')}\n}\n`
}

/** The recorded file, and the tick the run started from (after setup) for a difference at the first record. */
async function record(
  options: SimGoldenOptions,
  every: number,
): Promise<{ golden: SimGoldenFile; startTick: number }> {
  const sim = await createSim({
    seed: options.seed,
    plugins: options.plugins,
    ...(options.tickHz === undefined ? {} : { tickHz: options.tickHz }),
    ...(options.content === undefined ? {} : { content: options.content }),
  })
  try {
    options.setup?.(sim)
    const { schemaHash, contentHash } = sim.describeSnapshot().header
    const startTick = sim.tick
    const rng = createRng(deriveSeed(options.seed, 'golden-script'))
    const hashes: Array<{ tick: number; hash: string }> = []
    for (let t = 0; t < options.ticks; t++) {
      const { tick } = sim.step(options.script(sim.tick, rng))
      if (tick % every === 0) hashes.push({ tick, hash: sim.hash() })
    }
    const golden = {
      name: options.name,
      seed: options.seed,
      tickHz: sim.tickHz,
      ticks: options.ticks,
      every,
      schemaHash,
      contentHash,
      hashes,
    }
    return { golden, startTick }
  } finally {
    sim.dispose()
  }
}

/**
 * Plays a scripted run and compares the sim's hash every `every` ticks with the golden JSON file, reporting
 * the first recorded tick that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in Node it records the file. Throws
 * for an `every` that is not an integer of 1 or more; a mismatch is a report, not a throw.
 */
export async function simGolden(options: SimGoldenOptions): Promise<GoldenReport> {
  const every = options.every ?? 1
  if (!Number.isInteger(every) || every < 1) throw new Error(`simGolden: every must be an integer >= 1`)
  const file = resolveGoldenPath(`${options.dir}/__goldens__/${options.name}.golden.json`)
  const name = fileName(file)
  const { golden: actual, startTick } = await record(options, every)

  if (updatingGoldens()) {
    const bytes = new TextEncoder().encode(toFileText(actual))
    await writeGoldenFile(file, bytes)
    return { kind: 'written', name, file, bytes: bytes.length }
  }
  const stored = await readGoldenFile(file)
  if (!stored) return { kind: 'missing', name, file }
  const expected = parseGoldenFile(name, stored)

  for (const field of SETUP_FIELDS)
    if (expected[field] !== actual[field])
      return { kind: 'setup-changed', name, field, expected: expected[field], actual: actual[field] }
  if (expected.schemaHash !== actual.schemaHash)
    return { kind: 'schema-changed', name, expected: expected.schemaHash, actual: actual.schemaHash }
  if (expected.contentHash !== actual.contentHash)
    return { kind: 'content-changed', name, expected: expected.contentHash, actual: actual.contentHash }

  for (let i = 0; i < actual.hashes.length; i++) {
    const a = actual.hashes[i] as { tick: number; hash: string }
    const e = expected.hashes[i]
    if (e?.tick === a.tick && e.hash === a.hash) continue
    return {
      kind: 'diverged',
      name,
      firstTick: a.tick,
      lastGoodTick: i === 0 ? startTick : (actual.hashes[i - 1] as { tick: number }).tick,
      exact: every === 1,
      differences: [],
    }
  }
  return { kind: 'pass', name, checks: actual.hashes.length }
}
