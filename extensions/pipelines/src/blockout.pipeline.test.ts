// The `blockout` pipeline (M6 spec §4.11, M6.11, EP-a and EP-b) through the platform's router on a temporary folder: `run` validates and
// generates the scene's `sector-map` and `nav-graph` and is cached the second time; `check` passes a current pair and fails a stale one and
// a hand edit, each told apart; an invalid spec stops at `validate` (exit 1) and writes nothing.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { navGraphSchema } from '@mcthaydt/automata-nav/sim'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { sectorMapSchema } from '@mcthaydt/automata-sectors/sim'
import { Effect, Layer } from 'effect'
import { parse } from 'smol-toml'
import { afterEach, describe, expect, it } from 'vitest'
import { blockoutPipeline, blockoutPipeSpec } from './blockout.pipeline.ts'
import { route } from './router.ts'
import { TOY } from './testing/toy-blockout.ts'

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const SPEC = 'blockout = "blockout.json"\nmap = "content/maps/toy.toml"\nnav = "content/nav/toy.toml"\n'
function folder(blockout: unknown = TOY, spec = SPEC): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-blockout-'))
  temps.push(dir)
  writeFileSync(join(dir, 'pipeline.toml'), 'generated = ["content/maps/*.toml", "content/nav/*.toml"]\n')
  writeFileSync(join(dir, 'blockout.json'), `${JSON.stringify(blockout, null, 2)}\n`)
  writeFileSync(join(dir, 'blockout.pipe.toml'), spec)
  return dir
}
const layers = Layer.mergeAll(FilesLive, ProcessRunnerLive)
const pipe = (...argv: string[]) =>
  Effect.runPromise(Effect.provide(route([...argv, '--json'], [blockoutPipeline], []), layers)).then(
    (out) => ({
      exit: out.exit,
      json: JSON.parse(out.stdout) as Record<string, unknown>,
    }),
  )
const checks = (json: Record<string, unknown>) =>
  (json.data as { checks: { id: string; ok: boolean; detail: string }[] }).checks
const check = (json: Record<string, unknown>, id: string) => checks(json).find((c) => c.id === id)

const SHOOT = `// A stand-in for a game's shot command: reads the zones on stdin and writes a grey PNG for each, flat or a gradient by argument.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
const mode = process.argv[2]
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8); out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length); return out }
const png = (w, h, value) => { const header = Buffer.alloc(13); header.writeUInt32BE(w, 0); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 0; const raw = []; for (let y = 0; y < h; y++) { raw.push(0); for (let x = 0; x < w; x++) raw.push(value(x, y)) } return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]) }
let input = ''
for await (const part of process.stdin) input += part
const job = JSON.parse(input)
if (mode === 'fail') { console.error('the dev server is down'); process.exit(3) }
for (const shot of job.zones) {
  if (mode === 'missing' && shot.zone === 'b') continue
  writeFileSync(join(job.dir, shot.out), png(32, 32, mode === 'flat' ? () => 5 : (x) => 20 + x * 7))
}
`
const SHOTS_SPEC = (mode: string, extra = ''): string =>
  `${SPEC}\n[shots]\ncommand = ["node", "shoot.mjs", "${mode}"]\n${extra}`
const TWO_ZONES = {
  ...TOY,
  zones: [
    { id: 'a', look: [3.5, 1, 2], distance: 14 },
    { id: 'b', look: [5.5, 1, 2], distance: 12, area: { x: [4.1, null] } },
  ],
}
const shotsFolder = (mode: string, blockout: unknown = TWO_ZONES, extra = ''): string => {
  const dir = folder(blockout, SHOTS_SPEC(mode, extra))
  writeFileSync(join(dir, 'shoot.mjs'), SHOOT)
  return dir
}

describe('blockout.pipe.toml', () => {
  it('names the spec file and the two generated files; shots are optional', () => {
    expect(blockoutPipeSpec.safeParse({ blockout: 'b.json', map: 'm.toml', nav: 'n.toml' }).success).toBe(
      true,
    )
    const bad = blockoutPipeSpec.safeParse({ blockout: 'b.json' })
    expect(bad.success ? [] : bad.error.issues.map((i) => i.path)).toEqual([['map'], ['nav']])
  })
})

describe('automata pipe blockout', () => {
  it('EP-a: writes a sector-map and a nav-graph that load through their content schemas, cached the second time', async () => {
    const dir = folder()
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit).toBe(0)
    const map = readFileSync(join(dir, 'content/maps/toy.toml'), 'utf8')
    const nav = readFileSync(join(dir, 'content/nav/toy.toml'), 'utf8')
    expect(sectorMapSchema.safeParse(parse(map)).success).toBe(true)
    expect(navGraphSchema.safeParse(parse(nav)).success).toBe(true)
    expect(map).toMatch(/^# blockout xxh64:[0-9a-f]{16}\n# Generated by /)
    const again = await pipe('blockout', 'run', dir)
    expect((again.json.stages as { state: string }[]).every((s) => s.state === 'skipped')).toBe(true)
    const result = await pipe('blockout', 'check', dir)
    expect(result.exit).toBe(0)
    for (const id of ['validate', 'map', 'nav']) expect(check(result.json, id)?.ok, id).toBe(true)
  })

  it('EP-a: refuses a hand edit to either file, and tells it from a stale one', async () => {
    const dir = folder()
    await pipe('blockout', 'run', dir)
    for (const [id, file] of [
      ['map', 'content/maps/toy.toml'],
      ['nav', 'content/nav/toy.toml'],
    ] as const) {
      const original = readFileSync(join(dir, file), 'utf8')
      writeFileSync(join(dir, file), `${original}\n# a note\n`)
      const edited = await pipe('blockout', 'check', dir)
      expect(edited.exit).not.toBe(0)
      expect(check(edited.json, id)).toMatchObject({ ok: false })
      expect(check(edited.json, id)?.detail).toMatch(/hand/)
      writeFileSync(join(dir, file), original)
    }
    writeFileSync(
      join(dir, 'blockout.json'),
      `${JSON.stringify({ ...TOY, spawn: { ...TOY.spawn, x: 2 } }, null, 2)}\n`,
    )
    const stale = await pipe('blockout', 'check', dir)
    expect(check(stale.json, 'map')?.detail).toMatch(/stale/)
    expect(check(stale.json, 'nav')?.detail).toMatch(/stale/)
  })

  it('EP-b: an invalid spec stops at validate (exit 1) and writes nothing', async () => {
    const dir = folder({ ...TOY, openings: [{ ...(TOY.openings?.[0] as object), span: [3.5, 4.5] }] })
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit).toBe(1)
    expect(JSON.stringify(run.json)).toMatch(/no pair of facing/)
    expect(existsSync(join(dir, 'content'))).toBe(false)
    expect(existsSync(join(dir, 'validate.json'))).toBe(false)
  })

  it('EP-b: a spec that is not JSON stops at validate too, naming the file', async () => {
    const dir = folder()
    writeFileSync(join(dir, 'blockout.json'), '{ not json')
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit).toBe(1)
    expect(JSON.stringify(run.json)).toMatch(/blockout\.json/)
    expect(existsSync(join(dir, 'content'))).toBe(false)
  })

  it('fails check on an invalid spec even when the generated files are there', async () => {
    const dir = folder()
    await pipe('blockout', 'run', dir)
    writeFileSync(
      join(dir, 'blockout.json'),
      `${JSON.stringify({ ...TOY, zones: [...TOY.zones, ...TOY.zones] })}\n`,
    )
    const result = await pipe('blockout', 'check', dir)
    expect(check(result.json, 'validate')).toMatchObject({ ok: false })
    expect(check(result.json, 'validate')?.detail).toMatch(/zone a/)
  })
})

describe('the shots stage', () => {
  it('is skipped, saying so, without a [shots] table', async () => {
    const dir = folder()
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'shots.json'), 'utf8'))).toEqual({ configured: false })
  })

  it('runs the command with the zones on stdin and judges each grey shot legible', async () => {
    const dir = shotsFolder('gradient')
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit, JSON.stringify(run.json)).toBe(0)
    for (const zone of ['a', 'b']) expect(existsSync(join(dir, `grey-${zone}.png`)), zone).toBe(true)
    const report = JSON.parse(readFileSync(join(dir, 'shots.json'), 'utf8')) as {
      shots: { zone: string; legible: boolean; mean: number }[]
      skipped: string[]
    }
    expect(report.shots.map((s) => [s.zone, s.legible])).toEqual([
      ['a', true],
      ['b', true],
    ])
    expect(report.skipped).toEqual([])
  })

  it('lists a zone with nowhere to stand instead of shooting it', async () => {
    const far = {
      ...TWO_ZONES,
      zones: [...TWO_ZONES.zones, { id: 'far', look: [0, 0, 0], distance: 5, area: { x: [50, null] } }],
    }
    const dir = shotsFolder('gradient', far)
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'shots.json'), 'utf8')).skipped).toEqual(['far'])
  })

  it('fails on a shot that is not legible, naming the zone', async () => {
    const dir = shotsFolder('flat')
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit).toBe(1)
    expect(JSON.stringify(run.json)).toMatch(/not legible: a, b/)
  })

  it('takes the legibility bounds from the spec', async () => {
    const dir = shotsFolder('flat', TWO_ZONES, '[shots.legible]\nmean = [0, 255]\nspread = 0\n')
    expect((await pipe('blockout', 'run', dir)).exit).toBe(0)
  })

  it('fails when the command does, with what it said', async () => {
    const run = await pipe('blockout', 'run', shotsFolder('fail'))
    expect(run.exit).toBe(1)
    expect(JSON.stringify(run.json)).toMatch(/exited with 3.*the dev server is down/)
  })

  it('fails when the command leaves a zone without its shot', async () => {
    const run = await pipe('blockout', 'run', shotsFolder('missing'))
    expect(run.exit).toBe(1)
    expect(JSON.stringify(run.json)).toMatch(/grey-b\.png/)
  })

  it('does not run when the blockout does not validate', async () => {
    const dir = shotsFolder('gradient', { ...TWO_ZONES, zones: [...TWO_ZONES.zones, ...TWO_ZONES.zones] })
    const run = await pipe('blockout', 'run', dir)
    expect(run.exit).toBe(1)
    expect(existsSync(join(dir, 'grey-a.png'))).toBe(false)
  })
})
