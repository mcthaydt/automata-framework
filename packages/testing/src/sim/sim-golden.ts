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
import { fileName, readGoldenFile, resolveGoldenPath, updatingGoldens, writeGoldenFile } from './golden-files'
import type { GoldenReport } from './report'

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

async function record(options: SimGoldenOptions, every: number): Promise<SimGoldenFile> {
  const sim = await createSim({
    seed: options.seed,
    plugins: options.plugins,
    ...(options.tickHz === undefined ? {} : { tickHz: options.tickHz }),
    ...(options.content === undefined ? {} : { content: options.content }),
  })
  try {
    options.setup?.(sim)
    const { schemaHash, contentHash } = sim.describeSnapshot().header
    const rng = createRng(deriveSeed(options.seed, 'golden-script'))
    const hashes: Array<{ tick: number; hash: string }> = []
    for (let t = 0; t < options.ticks; t++) {
      const { tick } = sim.step(options.script(sim.tick, rng))
      if (tick % every === 0) hashes.push({ tick, hash: sim.hash() })
    }
    return {
      name: options.name,
      seed: options.seed,
      tickHz: sim.tickHz,
      ticks: options.ticks,
      every,
      schemaHash,
      contentHash,
      hashes,
    }
  } finally {
    sim.dispose()
  }
}

export async function simGolden(options: SimGoldenOptions): Promise<GoldenReport> {
  const every = options.every ?? 1
  if (!Number.isInteger(every) || every < 1) throw new Error(`simGolden: every must be an integer >= 1`)
  const file = resolveGoldenPath(`${options.dir}/__goldens__/${options.name}.golden.json`)
  const name = fileName(file)
  const actual = await record(options, every)

  if (updatingGoldens()) {
    const bytes = new TextEncoder().encode(toFileText(actual))
    await writeGoldenFile(file, bytes)
    return { kind: 'written', name, file, bytes: bytes.length }
  }
  const stored = await readGoldenFile(file)
  if (!stored) return { kind: 'missing', name, file }
  const expected = JSON.parse(new TextDecoder().decode(stored)) as SimGoldenFile

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
      lastGoodTick: i === 0 ? 0 : (actual.hashes[i - 1] as { tick: number }).tick,
      exact: every === 1,
      differences: [],
    }
  }
  return { kind: 'pass', name, checks: actual.hashes.length }
}
