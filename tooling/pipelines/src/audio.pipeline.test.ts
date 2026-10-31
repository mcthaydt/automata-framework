// The `audio` pipeline (M6 spec §4.10, M6.10b, AS-a) through the platform's router on a temporary folder holding the example: `run`
// renders every cue, bed and mix offline in Chromium and measures them; `check` passes the example (true peak, clicks, ducking,
// panning, coverage) and fails a cue that is too hot, an event nothing answers and a render that is stale.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { audioPipeline, audioPipeSpec } from './audio.pipeline.ts'
import { route } from './router.ts'

const FIXTURE = join(
  dirname(createRequire(import.meta.url).resolve('@mcthaydt/automata-audio-synth/package.json')),
  'fixtures/cues.audio.toml',
)
const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const SPEC = `content = "cues.audio.toml"
events = ["ui.confirm", "player.landed", "player.step", "npc.speaks", "tick.sim"]
tail = 0.3
bed_seconds = 2
true_peak_dbtp = -1

[loudness]
mix = "gameplay"
lufs = -18
tolerance_lu = 4

[mix.gameplay]
bed = "hum"
sequence = "cues"
`
function folder(edit?: (content: string) => string, spec = SPEC): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-audio-'))
  temps.push(dir)
  writeFileSync(join(dir, 'pipeline.toml'), '[budget]\n')
  const content = readFileSync(FIXTURE, 'utf8')
  writeFileSync(join(dir, 'cues.audio.toml'), edit ? edit(content) : content)
  writeFileSync(join(dir, 'audio.pipe.toml'), spec)
  return dir
}
const layers = Layer.mergeAll(FilesLive, ProcessRunnerLive)
const pipe = (...argv: string[]) =>
  Effect.runPromise(Effect.provide(route([...argv, '--json'], [audioPipeline], []), layers)).then((out) => ({
    exit: out.exit,
    json: JSON.parse(out.stdout) as Record<string, unknown>,
  }))
const checks = (json: Record<string, unknown>) =>
  (json.data as { checks: { id: string; ok: boolean; detail: string }[] }).checks
const check = (json: Record<string, unknown>, id: string) => checks(json).find((c) => c.id === id)

describe('audio.pipe.toml', () => {
  it('parses a content file, events, targets, a loudness target and mixes', () => {
    expect(
      audioPipeSpec.safeParse(JSON.parse(JSON.stringify({ content: 'a.toml', tail: 0.5 }))).success,
    ).toBe(true)
    const bad = audioPipeSpec.safeParse({ tail: 1 })
    expect(bad.success ? [] : bad.error.issues.map((i) => i.path)).toEqual([['content']])
  })
})

describe('the audio pipeline', () => {
  it('renders every cue, bed and mix to WAV files and records their measurements', {
    timeout: 120_000,
  }, async () => {
    const dir = folder()
    const run = await pipe('audio', 'run', dir)
    expect(run.exit).toBe(0)
    for (const f of [
      'cues/ping.wav',
      'cues/thud.wav',
      'cues/step.wav',
      'cues/line.wav',
      'beds/hum.wav',
      'mixes/gameplay.wav',
    ])
      expect(existsSync(join(dir, f)), f).toBe(true)
    const record = JSON.parse(readFileSync(join(dir, 'render.json'), 'utf8')) as {
      renders: { file: string; peak: number | null }[]
    }
    expect(record.renders.map((r) => r.file)).toContain('cues/thud.wav')
  })

  it('passes the example: every cue under the true-peak and click limits (AS-a)', {
    timeout: 120_000,
  }, async () => {
    const dir = folder()
    await pipe('audio', 'run', dir)
    const { exit, json } = await pipe('audio', 'check', dir)
    expect(checks(json).filter((c) => !c.ok)).toEqual([])
    expect(exit).toBe(0)
    for (const id of ['render', 'true-peak', 'clicks', 'loudness', 'ducking', 'panning', 'coverage'])
      expect(check(json, id)?.ok, id).toBe(true)
    expect(check(json, 'ducking')?.detail).toMatch(/-1[12]\./)
  })

  it('fails a cue over the true-peak ceiling and names it', { timeout: 120_000 }, async () => {
    const dir = folder((c) =>
      c.replace('volume = 0.3 }]\n\n[[cue]]\nid = "thud"', 'volume = 3 }]\n\n[[cue]]\nid = "thud"'),
    )
    await pipe('audio', 'run', dir)
    const { exit, json } = await pipe('audio', 'check', dir)
    expect(exit).not.toBe(0)
    expect(check(json, 'true-peak')?.ok).toBe(false)
    expect(check(json, 'true-peak')?.detail).toContain('cues/ping.wav')
  })

  it('fails an event no row answers', { timeout: 120_000 }, async () => {
    const dir = folder(undefined, SPEC.replace('"tick.sim"]', '"tick.sim", "door.opened"]'))
    await pipe('audio', 'run', dir)
    const { json } = await pipe('audio', 'check', dir)
    expect(check(json, 'coverage')?.ok).toBe(false)
    expect(check(json, 'coverage')?.detail).toContain('door.opened')
  })

  it('fails a render that is stale after the content changed', { timeout: 120_000 }, async () => {
    const dir = folder()
    await pipe('audio', 'run', dir)
    writeFileSync(
      join(dir, 'cues.audio.toml'),
      `${readFileSync(join(dir, 'cues.audio.toml'), 'utf8')}\n# edited\n`,
    )
    const { json } = await pipe('audio', 'check', dir)
    expect(check(json, 'render')?.ok).toBe(false)
    expect(check(json, 'render')?.detail).toMatch(/stale|changed|run/)
  })
})
