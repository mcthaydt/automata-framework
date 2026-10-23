// replayGolden (M2.3 spec §3.6): a golden that is a `.replay` with reference data, so when a run diverges the
// report names the exact tick and every field that differs there.
import { createSim, type PluginDef, type Sim, SnapshotMismatchError } from '@mcthaydt/automata-sim'
import {
  createRecorder,
  createReplayStepper,
  encodeReplay,
  packReplay,
  REPLAY_INFLATE_MAX_BYTES,
  type Recorder,
  type Replay,
  ReplayRecordError,
  type ReplayStepper,
  unpackReplay,
} from '@mcthaydt/automata-sim/replay'
import { nodeCompression, streamCompression } from './compression'
import { type Difference, diffSnapshotViews } from './diff'
import {
  fileName,
  inNode,
  readGoldenFile,
  resolveGoldenPath,
  updatingGoldens,
  writeGoldenFile,
} from './golden-files'
import type { GoldenReport } from './report'

/** A golden that passes this cannot be reviewed or loaded cheaply; lower snapshotEvery's cost instead. */
export const GOLDEN_MAX_PACKED_BYTES: number = 512 * 1024

type RecordFrom =
  | {
      readonly seed: number
      readonly tickHz?: number
      readonly setup?: (sim: Sim) => void
      readonly create?: never
    }
  | {
      readonly create: () => Promise<Sim>
      readonly seed?: never
      readonly tickHz?: never
      readonly setup?: never
    }

/**
 * What `replayGolden` checks: the `.replay` file, the plugins and content to replay it with, and how to
 * record it when updating goldens.
 */
export interface ReplayGoldenOptions {
  /** A deflated `.replay`; a relative path is taken from the test file's folder. */
  readonly file: string
  readonly plugins: readonly PluginDef[]
  readonly content?: unknown
  /**
   * How to record the golden when updating (Node, AUTOMATA_UPDATE_GOLDENS=1); absent for replays recorded
   * elsewhere. Either seed/tickHz/setup, or `create`, a game's own sim factory.
   */
  readonly record?: RecordFrom & {
    readonly drive: (recorder: Recorder, sim: Sim) => void | Promise<void>
    /** A reference snapshot every this many ticks (default 1, so a divergence is diffed at its exact tick). */
    readonly snapshotEvery?: number
  }
}

const compression = () => (inNode() ? nodeCompression : streamCompression)
const setupOf = (options: ReplayGoldenOptions) => ({
  plugins: options.plugins,
  ...(options.content === undefined ? {} : { content: options.content }),
})

async function recordGolden(
  options: ReplayGoldenOptions,
  record: NonNullable<ReplayGoldenOptions['record']>,
) {
  const snapshotEvery = record.snapshotEvery ?? 1
  const sim = record.create
    ? await record.create()
    : await createSim({
        seed: record.seed,
        ...setupOf(options),
        ...(record.tickHz === undefined ? {} : { tickHz: record.tickHz }),
      })
  let replay: Replay
  try {
    if (!record.create) record.setup?.(sim)
    const recorder = createRecorder(sim, { reference: { snapshotEvery } })
    await record.drive(recorder, sim)
    replay = recorder.finish()
  } finally {
    sim.dispose()
  }

  // Play it back before writing: setup done outside recorder.step (a spawn mid-run) would not reproduce.
  const stepper = await createReplayStepper(replay, setupOf(options))
  try {
    const outcome = stepper.run()
    if (outcome.failed)
      throw new ReplayRecordError(`the recording does not reproduce: diverged at tick ${outcome.failed.tick}`)
  } finally {
    stepper.dispose()
  }

  const encoded = encodeReplay(replay)
  if (encoded.length > REPLAY_INFLATE_MAX_BYTES)
    throw new Error(
      `${fileName(options.file)}: ${encoded.length} bytes encoded, over the ${REPLAY_INFLATE_MAX_BYTES}-byte inflate cap, ` +
        `so it could never be read back; record fewer ticks or raise snapshotEvery (now ${snapshotEvery})`,
    )
  const packed = await packReplay(replay, nodeCompression)
  if (packed.length > GOLDEN_MAX_PACKED_BYTES)
    throw new Error(
      `${fileName(options.file)}: ${packed.length} bytes packed, over the 512 KiB golden cap; ` +
        `record fewer ticks or raise snapshotEvery (now ${snapshotEvery})`,
    )
  return packed
}

/** Where the stepper has got to, and the last check that matched. */
interface Failure {
  readonly tick: number
  readonly lastGoodTick: number
}

/** Steps to the end, comparing only at checks (one hash per checkEvery ticks on the passing path). */
function fastPath(stepper: ReplayStepper, replay: Replay): { checks: number } | Failure {
  let lastGoodTick = replay.header.startTick
  let checks = 0
  while (!stepper.done) {
    const { tick, check } = stepper.step()
    if (!check) continue
    if (check.expected !== check.actual) return { tick, lastGoodTick }
    lastGoodTick = tick
    checks += 1
  }
  return { checks }
}

/**
 * With reference data: restore the latest reference snapshot at or before the last good check (or the start),
 * then step one tick at a time, comparing every tick's hash, to find the first that differs (spec §3.6).
 */
function bisect(
  stepper: ReplayStepper,
  replay: Replay,
  failure: Failure,
): GoldenReport & { kind: 'diverged' } {
  const reference = replay.reference as NonNullable<Replay['reference']>
  const { startTick } = replay.header
  const { sim } = stepper
  let from: { tick: number; bytes: Uint8Array } = { tick: startTick, bytes: replay.start }
  for (const snap of reference.snapshots) if (snap.tick <= failure.lastGoodTick) from = snap
  sim.restore(from.bytes)

  let firstTick: number | undefined
  while (!stepper.done) {
    const { tick, check } = stepper.step()
    const rejected = check?.expected === 'accepted'
    if (rejected || sim.hash() !== reference.hashes[tick - startTick - 1]) {
      firstTick = tick
      break
    }
  }
  if (firstTick === undefined) firstTick = failure.tick // cannot happen for a replay that recorded its own hashes

  // Diff at the first divergent tick when a snapshot was stored there; otherwise at the next one stored.
  const stored = reference.snapshots.find((s) => s.tick >= (firstTick as number))
  let differences: Difference[] = []
  if (stored) {
    while (sim.tick < stored.tick) stepper.step()
    differences = diffSnapshotViews(sim.describeSnapshot(stored.bytes), sim.describeSnapshot())
  }
  return {
    kind: 'diverged',
    name: '',
    firstTick,
    lastGoodTick: failure.lastGoodTick,
    exact: true,
    ...(stored && stored.tick !== firstTick ? { diffTick: stored.tick } : {}),
    differences,
  }
}

async function checkGolden(options: ReplayGoldenOptions, file: string, name: string): Promise<GoldenReport> {
  const bytes = await readGoldenFile(file)
  if (!bytes) return { kind: 'missing', name, file }
  const replay = await unpackReplay(bytes, compression())
  let stepper: ReplayStepper
  try {
    stepper = await createReplayStepper(replay, setupOf(options))
  } catch (err) {
    // The error's expected is this sim's hash and its actual the golden's; the report says it the other way.
    if (err instanceof SnapshotMismatchError && err.field !== 'tickHz') {
      const kind = err.field === 'schemaHash' ? 'schema-changed' : 'content-changed'
      return { kind, name, expected: err.actual, actual: err.expected }
    }
    throw err
  }
  try {
    const outcome = fastPath(stepper, replay)
    if ('checks' in outcome) return { kind: 'pass', name, checks: outcome.checks }
    if (!replay.reference)
      return {
        kind: 'diverged',
        name,
        firstTick: outcome.tick,
        lastGoodTick: outcome.lastGoodTick,
        exact: false,
        differences: [],
      }
    return { ...bisect(stepper, replay, outcome), name }
  } finally {
    stepper.dispose()
  }
}

/**
 * Replays a golden `.replay` against the current sim and reports whether it still matches. With reference
 * data a divergence names the exact tick and every field that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in
 * Node and a `record` option it records the file first, then checks what it wrote. A mismatch is a report, not
 * a throw: pass it to `expectGolden`.
 */
export async function replayGolden(options: ReplayGoldenOptions): Promise<GoldenReport> {
  const file = resolveGoldenPath(options.file)
  const name = fileName(file)
  if (options.record && updatingGoldens()) {
    const packed = await recordGolden(options, options.record)
    await writeGoldenFile(file, packed)
    // Then, always, check what was written.
    const report = await checkGolden(options, file, name)
    return report.kind === 'pass' ? { kind: 'written', name, file, bytes: packed.length } : report
  }
  return checkGolden(options, file, name)
}
