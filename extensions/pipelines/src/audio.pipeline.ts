// The `audio` pipeline (M6 spec §4.10, M6.10b): an `audio.pipe.toml` names a game's `audio` content (cues, beds, ducks, event map).
// `render` plays every cue, bed and mix offline in headless Chromium (Node has no `OfflineAudioContext`, AU-D5), writes WAV files
// and records what it measured in `render.json`: true peak, clicks and loudness per file, the depth each duck takes the music
// down, the pan of a world cue and the loudness of the mixes. `check` reads that record and fails on a render that is stale, a cue
// over the true-peak ceiling, a click, a loudness target missed, a duck off its rule, a world cue that does not pan and an event
// nothing answers, and, with a `[music]` table, recorded music over its loudness target or true-peak ceiling. Free: no stage is
// paid. The sample budget is not part of it: it is core's asset budget (AU-D6).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AudioContent } from '@mcthaydt/automata-audio-synth'
import { Files } from '@mcthaydt/automata-node'
import { canonicalJson } from '@mcthaydt/automata-sim'
import { hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { Effect } from 'effect'
import { parse as parseToml } from 'smol-toml'
import { z } from 'zod'
import { type AudioRenderer, openAudioRenderer } from './audio-browser.ts'
import {
  type CheckResult,
  definePipeline,
  type PipelineDef,
  type StageContext,
  StageFailed,
} from './pipeline.ts'

export interface AudioPipeSpec {
  /** The `audio` content file (TOML), inside the folder. */
  readonly content: string
  /** The game events the audio must answer: each a cued row or a silent reason. */
  readonly events?: readonly string[] | undefined
  /** Seconds past a cue's length to render (default 0.5). */
  readonly tail?: number | undefined
  /** Seconds each bed renders (default 4). */
  readonly bed_seconds?: number | undefined
  /** The true-peak ceiling in dBTP (default -1). */
  readonly true_peak_dbtp?: number | undefined
  /** A mix the loudness target applies to. */
  readonly loudness?:
    | { readonly mix: string; readonly lufs: number; readonly tolerance_lu: number }
    | undefined
  /** Recorded music (AU-D6, amended): every WAV in `dir` is measured against the target. */
  readonly music?:
    | {
        readonly dir: string
        readonly lufs: number
        readonly tolerance_lu: number
        /** The true-peak ceiling in dBTP (default: the pipeline's `true_peak_dbtp`, else -1). */
        readonly true_peak_dbtp?: number | undefined
      }
    | undefined
  readonly mix?:
    | Readonly<
        Record<
          string,
          {
            readonly bed?: string | undefined
            readonly seconds?: number | undefined
            /** `cues`: every cue in order, spaced by its length. */
            readonly sequence: 'cues' | readonly { readonly t: number; readonly cue: string }[]
          }
        >
      >
    | undefined
}
export const audioPipeSpec: z.ZodType<AudioPipeSpec> = z.strictObject({
  content: z.string().min(1),
  events: z.array(z.string().min(1)).optional(),
  tail: z.number().min(0).optional(),
  bed_seconds: z.number().positive().optional(),
  true_peak_dbtp: z.number().max(0).optional(),
  loudness: z
    .strictObject({ mix: z.string().min(1), lufs: z.number(), tolerance_lu: z.number().positive() })
    .optional(),
  music: z
    .strictObject({
      dir: z.string().min(1),
      lufs: z.number(),
      tolerance_lu: z.number().positive(),
      true_peak_dbtp: z.number().max(0).optional(),
    })
    .optional(),
  mix: z
    .record(
      z.string(),
      z.strictObject({
        bed: z.string().min(1).optional(),
        seconds: z.number().positive().optional(),
        sequence: z.union([
          z.literal('cues'),
          z.array(z.strictObject({ t: z.number().min(0), cue: z.string().min(1) })),
        ]),
      }),
    )
    .optional(),
})

export const SAMPLE_RATE = 48000
const RECORD = 'render.json'
const PROBE = '__probe'
type Ctx = StageContext<AudioPipeSpec>

/** One rendered file and what was measured of it. `null` stands for -Infinity or too short to measure. */
interface Measured {
  readonly file: string
  readonly lufs: number | null
  readonly peak: number | null
  readonly clicks: readonly number[]
}
interface RenderRecord {
  readonly inputHash: string
  readonly sampleRate: number
  readonly renders: readonly Measured[]
  /** For each duck rule and bus it ducks that has a bed: the depth measured against the rule's. */
  readonly ducks: readonly {
    readonly bus: string
    readonly ducked: string
    readonly expected: number
    readonly db: number
  }[]
  /** A world cue rendered 4 m left and 4 m right of the listener: the rms of each ear. */
  readonly spatial: {
    readonly cue: string
    readonly left: readonly [number, number]
    readonly right: readonly [number, number]
  } | null
}

const finite = (v: number | null): number | null => (v !== null && Number.isFinite(v) ? v : null)
const failing = (stage: string) => (cause: unknown) =>
  new StageFailed({ stage, reason: cause instanceof Error ? cause.message : String(cause) })

/** The content, validated, and the stamp renders are checked against. */
const load = (ctx: Ctx, stage: string) =>
  Effect.gen(function* () {
    const files = yield* Files
    const text = yield* files.readText(join(ctx.dir, ctx.spec.content))
    const spec = yield* files.readText(ctx.specPath)
    const { audioSchema } = yield* Effect.tryPromise({
      try: () => import('@mcthaydt/automata-audio-synth'),
      catch: failing(stage),
    })
    const content = yield* Effect.try({
      try: () => audioSchema.parse(parseToml(text)) as AudioContent,
      catch: (cause) => new StageFailed({ stage, reason: `${ctx.spec.content}: ${String(cause)}` }),
    })
    return { content, hash: hex64(xxhash64(utf8(`${text}\0${spec}`))) }
  })

type MusicTarget = NonNullable<AudioPipeSpec['music']>

/**
 * Recorded music against its target (AU-D6, amended). Every WAV under `dir` is decoded and measured; a file that is not a WAV
 * cannot be measured and fails the row by name (never skipped, never passed), and a folder with no music fails too, so a mistyped
 * `dir` cannot read as a pass. It needs no render: the files are the game's, not the pipeline's.
 */
const musicLoudness = (ctx: Ctx, target: MusicTarget) =>
  Effect.gen(function* () {
    const files = yield* Files
    const root = join(ctx.dir, target.dir)
    const names = (yield* files.exists(root)) ? yield* files.listFiles(root) : []
    const ceiling = target.true_peak_dbtp ?? ctx.spec.true_peak_dbtp ?? -1
    const { decodeWav, integratedLoudness, truePeak } = yield* Effect.tryPromise({
      try: () => import('@mcthaydt/automata-audio-synth/measure'),
      catch: failing('check'),
    })
    const problems: string[] = []
    const fine: string[] = []
    for (const name of names) {
      const label = `${target.dir}/${name}`
      let wav: ReturnType<typeof decodeWav> | undefined
      try {
        wav = decodeWav(yield* files.readBytes(join(root, name)))
      } catch (cause) {
        const why = cause instanceof Error ? cause.message : String(cause)
        problems.push(`${label} cannot be measured (${why})`)
        continue
      }
      const lufs = finite(integratedLoudness(wav.channels, wav.sampleRate))
      const peak = finite(truePeak(wav.channels))
      const off = lufs === null ? null : lufs - target.lufs
      if (off === null) problems.push(`${label} is too quiet to measure`)
      else if (Math.abs(off) > target.tolerance_lu)
        problems.push(`${label} ${db(lufs as number)} LUFS, target ${target.lufs} ± ${target.tolerance_lu}`)
      else if (peak !== null && peak > ceiling)
        problems.push(`${label} ${db(peak)} dBTP, over ${ceiling} dBTP`)
      else fine.push(label)
    }
    const ok = names.length > 0 && problems.length === 0
    return {
      id: 'music-loudness',
      ok,
      detail:
        names.length === 0
          ? `no music files in ${target.dir}`
          : ok
            ? `${fine.join(', ')} within ${target.lufs} ± ${target.tolerance_lu} LUFS and under ${ceiling} dBTP`
            : problems.join('; '),
    } satisfies CheckResult
  })

const cueSeconds = async (content: AudioContent, id: string, tail: number): Promise<number> => {
  const { cueLength } = await import('@mcthaydt/automata-audio-synth')
  const cue = (content.cue ?? []).find((c) => c.id === id)
  return (cue === undefined ? 0 : cueLength(cue)) + tail
}

type Meter = typeof import('@mcthaydt/automata-audio-synth/measure')

function measure(m: Meter, file: string, channels: readonly Float32Array[]): Measured {
  const { clicks, integratedLoudness, truePeak } = m
  return {
    file,
    lufs: finite(integratedLoudness(channels, SAMPLE_RATE)),
    peak: finite(truePeak(channels)),
    clicks: channels.flatMap((c) => clicks(c, SAMPLE_RATE)).slice(0, 8),
  }
}

async function renderAll(
  ctx: Ctx,
  content: AudioContent,
  hash: string,
  renderer: AudioRenderer,
): Promise<RenderRecord> {
  // Loaded when the stage runs, not at import: the bin runs from source and resolves these through the SB-D6 hook (as `narrative`).
  const { cueLength } = await import('@mcthaydt/automata-audio-synth')
  const meter = await import('@mcthaydt/automata-audio-synth/measure')
  const { encodeWav, rms } = meter
  const tail = ctx.spec.tail ?? 0.5
  const out: Measured[] = []
  const put = (file: string, channels: number[][]): void => {
    const planes = channels.map((c) => Float32Array.from(c))
    mkdirSync(dirname(join(ctx.dir, file)), { recursive: true })
    writeFileSync(join(ctx.dir, file), encodeWav(planes, SAMPLE_RATE))
    out.push(measure(meter, file, planes))
  }
  for (const cue of content.cue ?? [])
    put(`cues/${cue.id}.wav`, await renderer.cue(content, cue.id, { seconds: cueLength(cue) + tail }))
  for (const bed of content.bed ?? [])
    put(`beds/${bed.id}.wav`, await renderer.bed(content, bed.id, ctx.spec.bed_seconds ?? 4))
  for (const [name, mix] of Object.entries(ctx.spec.mix ?? {})) {
    let sequence: { t: number; cue: string }[]
    let seconds = mix.seconds ?? 0
    if (mix.sequence === 'cues') {
      sequence = []
      let t = 0.1
      for (const cue of content.cue ?? []) {
        sequence.push({ t, cue: cue.id })
        t += cueLength(cue) + 0.3
      }
      seconds = mix.seconds ?? t
    } else sequence = mix.sequence.map((s) => ({ ...s }))
    put(`mixes/${name}.wav`, await renderer.mix(content, { seconds, bed: mix.bed ?? null, sequence }))
  }

  // Ducking: each rule's bus plays a line too quiet to hear at 1 s; the bed under a ducked bus is measured with and without it.
  const probed: AudioContent = {
    ...content,
    cue: [
      ...(content.cue ?? []),
      ...(content.duck ?? []).map((rule) => ({
        id: `${PROBE}-${rule.bus}`,
        bus: rule.bus,
        voices: [{ tone: 'sine' as const, from: 300, to: 300, length: 1, volume: 1e-9 }],
      })),
    ],
  }
  const ducks: RenderRecord['ducks'][number][] = []
  const window = [Math.round(1.3 * SAMPLE_RATE), Math.round(1.9 * SAMPLE_RATE)] as const
  for (const rule of content.duck ?? []) {
    for (const ducked of rule.duck) {
      const bed = (content.bed ?? []).find((b) => b.bus === ducked)
      if (bed === undefined) continue
      const options = { seconds: 3.5, at: 1, bed: bed.id }
      const dry = (await renderer.duck(probed, { ...options, line: null }))[0] ?? []
      const wet = (await renderer.duck(probed, { ...options, line: `${PROBE}-${rule.bus}` }))[0] ?? []
      ducks.push({
        bus: rule.bus,
        ducked,
        expected: rule.db,
        db: 20 * Math.log10(rms(wet, ...window) / rms(dry, ...window)),
      })
    }
  }

  // Panning: the first world cue, 4 m to the listener's left and right (yaw 0: right is +x).
  const world = (content.cue ?? []).find((c) => c.world === true)
  let spatial: RenderRecord['spatial'] = null
  if (world !== undefined) {
    const seconds = await cueSeconds(content, world.id, tail)
    const side = async (x: number): Promise<[number, number]> => {
      const [l = [], r = []] = await renderer.cue(content, world.id, {
        seconds,
        place: { at: { x, z: 0 }, listener: { x: 0, z: 0, yaw: 0 } },
      })
      return [rms(l, 0, l.length), rms(r, 0, r.length)]
    }
    spatial = { cue: world.id, left: await side(-4), right: await side(4) }
  }
  return { inputHash: hash, sampleRate: SAMPLE_RATE, renders: out, ducks, spatial }
}

const readRecord = (ctx: Ctx) =>
  Effect.gen(function* () {
    const files = yield* Files
    const path = join(ctx.dir, RECORD)
    if (!(yield* files.exists(path))) return null
    return JSON.parse(yield* files.readText(path)) as RenderRecord
  })

const db = (n: number): string => n.toFixed(1)

export const audioPipeline: PipelineDef<AudioPipeSpec> = definePipeline<AudioPipeSpec>({
  name: 'audio',
  spec: audioPipeSpec,
  specFile: 'audio.pipe.toml',
  stages: [
    {
      id: 'render',
      inputs: (ctx) => ['audio.pipe.toml', ctx.spec.content],
      outputs: () => [RECORD],
      run: (ctx) =>
        Effect.gen(function* () {
          const { content, hash } = yield* load(ctx, 'render')
          const record = yield* Effect.acquireUseRelease(
            Effect.tryPromise({ try: openAudioRenderer, catch: failing('render') }),
            (renderer) =>
              Effect.tryPromise({
                try: () => renderAll(ctx, content, hash, renderer),
                catch: failing('render'),
              }),
            (renderer) => Effect.promise(() => renderer.close()),
          )
          const files = yield* Files
          yield* files.writeText(
            join(ctx.dir, RECORD),
            `${canonicalJson(JSON.parse(JSON.stringify(record)))}\n`,
          )
          return { notes: `${record.renders.length} renders, ${record.ducks.length} ducks` }
        }),
    },
  ],
  check: (ctx) =>
    Effect.gen(function* () {
      const { content, hash } = yield* load(ctx, 'check')
      const record = yield* readRecord(ctx)
      const results: CheckResult[] = []
      const add = (id: string, ok: boolean, detail: string): void => {
        results.push({ id, ok, detail })
      }
      const fresh = record !== null && record.inputHash === hash
      add(
        'render',
        fresh,
        record === null
          ? `no ${RECORD}: run \`automata pipe audio run\``
          : fresh
            ? 'the renders match the content and the spec'
            : `the renders are stale: the content or the spec changed (run \`automata pipe audio run\`)`,
      )
      if (record !== null && fresh) {
        const ceiling = ctx.spec.true_peak_dbtp ?? -1
        const hot = record.renders.filter((r) => r.peak !== null && r.peak > ceiling)
        add(
          'true-peak',
          hot.length === 0,
          hot.length > 0
            ? `over ${ceiling} dBTP: ${hot.map((r) => `${r.file} ${db(r.peak as number)}`).join(', ')}`
            : `${record.renders.length} renders at or under ${ceiling} dBTP`,
        )
        const clicky = record.renders.filter((r) => r.clicks.length > 0)
        add(
          'clicks',
          clicky.length === 0,
          clicky.length > 0
            ? `clicks in ${clicky
                .map(
                  (r) =>
                    `${r.file} at ${r.clicks
                      .slice(0, 3)
                      .map((i) => (i / record.sampleRate).toFixed(3))
                      .join(', ')} s`,
                )
                .join('; ')}`
            : `no clicks in ${record.renders.length} renders`,
        )
        const target = ctx.spec.loudness
        if (target !== undefined) {
          const mix = record.renders.find((r) => r.file === `mixes/${target.mix}.wav`)
          const off = mix?.lufs == null ? null : mix.lufs - target.lufs
          add(
            'loudness',
            off !== null && Math.abs(off) <= target.tolerance_lu,
            mix === undefined
              ? `no mix "${target.mix}" in the spec`
              : `${target.mix} mix ${mix.lufs === null ? 'n/a' : db(mix.lufs)} LUFS, target ${target.lufs} ± ${target.tolerance_lu}`,
          )
        }
        const off = record.ducks.filter((d) => Math.abs(d.db - d.expected) > 1.5)
        add(
          'ducking',
          off.length === 0,
          record.ducks.length === 0
            ? 'no duck rule has a bed under it to measure'
            : record.ducks
                .map((d) => `a ${d.bus} line ducks ${d.ducked} by ${db(d.db)} dB (rule ${d.expected} dB)`)
                .join('; '),
        )
        const s = record.spatial
        if (s !== null)
          add(
            'panning',
            s.left[0] > 2 * s.left[1] && s.right[1] > 2 * s.right[0],
            `${s.cue}: left source L/R ${db(20 * Math.log10(s.left[0] / s.left[1]))} dB, right source R/L ${db(20 * Math.log10(s.right[1] / s.right[0]))} dB`,
          )
      }
      if (ctx.spec.music !== undefined) results.push(yield* musicLoudness(ctx, ctx.spec.music))
      if (ctx.spec.events !== undefined) {
        const { coverage } = yield* Effect.tryPromise({
          try: () => import('@mcthaydt/automata-audio-synth'),
          catch: failing('check'),
        })
        const cov = coverage(content, new Map(ctx.spec.events.map((e) => [e, 'audio.pipe.toml'])))
        add(
          'coverage',
          cov.ok,
          cov.ok
            ? `${cov.events} events: ${cov.cued} cued, ${cov.silent.length} silent by decision`
            : `no row answers: ${cov.missing.map((m) => m.event).join(', ')}`,
        )
      }
      return results
    }),
})
