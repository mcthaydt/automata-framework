// One-off converter (M6 spec §4.8, M6-D6): the adventure source's four scenes' cutscene libraries (functions of a context)
// become TOML fixtures, each script evaluated once in a canonical context (Ada at the scene's spawn, the Nurse at the first
// stop of her patrol) with absolute positions (CS-D4). Run once against a checkout of the source, with type transforms on
// (the source's modules use parameter properties); it prints the commit it read, which the framework's provenance file records:
//   node --experimental-transform-types --import ./scripts/register-ts.mjs scripts/convert-adventure-cutscenes.ts <source checkout>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stringify } from 'smol-toml'

const source = process.argv[2]
if (source === undefined) throw new Error('usage: convert-adventure-cutscenes.ts <source checkout>')
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const load = async (path: string): Promise<Record<string, unknown>> =>
  (await import(pathToFileURL(join(source, path)).href)) as Record<string, unknown>

/** TOML has no undefined or null members: they are dropped. */
const defined = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(defined)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, defined(v)]),
        )
      : value

interface Key {
  t: number
  [k: string]: unknown
}
interface Old {
  duration: number
  camera: Key[]
  nurse?: Key[]
  player?: Key[]
  captions: { t: number; until: number; speaker?: string; text: string; line?: string }[]
  sound?: { t: number; kind: string }[]
  light?: { t: number; lamp: string; level: number }[]
  shake?: [number, number, number][]
  flicker?: [number, number][]
  fade?: { t: number; value: number }[]
  states?: { t: number; state: string }[]
  powerAt?: number
  exitOpenAt?: number
  flatline?: boolean
  victory?: boolean
  lintAllow?: { rule: string; reason: string; context?: string }[]
}

/** A script's keys in time order (the evaluator reads them so; the source's `bay/arrival` has two nurse keys 0.06 s out of order). */
function ordered<K extends { t: number }>(keys: K[], id: string, what: string, reordered: string[]): K[] {
  const sorted = [...keys].sort((a, b) => a.t - b.t)
  if (sorted.some((k, i) => k !== keys[i])) reordered.push(`${id} ${what}`)
  return sorted
}

function convert(id: string, s: Old, unlined: string[], reordered: string[]) {
  const actor = [
    ...ordered(s.player ?? [], id, 'player', reordered).map((k) => ({ who: 'player', ...k })),
    ...ordered(s.nurse ?? [], id, 'nurse', reordered).map((k) => ({ who: 'nurse', ...k })),
  ]
  const states = [
    ...(s.states ?? []),
    ...(s.flatline === true ? [{ t: 0, state: 'flatline' }] : []),
    ...(s.powerAt === undefined ? [] : [{ t: s.powerAt, state: 'power' }]),
    ...(s.exitOpenAt === undefined ? [] : [{ t: s.exitOpenAt, state: 'exitOpen' }]),
  ].sort((a, b) => a.t - b.t)
  const caption = s.captions.flatMap((c) => {
    if (c.line === undefined) {
      unlined.push(`${id}@${c.t}`)
      return []
    }
    return [
      {
        t: c.t,
        until: c.until,
        line: c.line,
        ...(c.speaker === undefined ? {} : { speaker: c.speaker.toLowerCase() }),
      },
    ]
  })
  return defined({
    id,
    duration: s.duration,
    camera: ordered(s.camera, id, 'camera', reordered),
    actor: actor.length > 0 ? actor : undefined,
    caption: caption.length > 0 ? caption : undefined,
    light: s.light,
    sound: s.sound,
    shake: s.shake,
    flicker: s.flicker,
    fade: s.fade,
    states: states.length > 0 ? states : undefined,
    victory: s.victory === true ? true : undefined,
    lintAllow: s.lintAllow,
  })
}

for (const scene of ['prologue', 'clinic', 'clinic-dawn', 'bay']) {
  const level = await load(`src/scenes/${scene}/level.ts`).catch(() => ({}) as Record<string, unknown>)
  const spawn = (level.SPAWN as { x: number; z: number; facing?: number } | undefined) ?? { x: 0, z: 0 }
  const nodes = (level.NODES as Record<string, { x: number; z: number }> | undefined) ?? {}
  const patrol = (level.PATROL as string[] | undefined) ?? []
  const first = nodes[patrol[0] ?? ''] ?? spawn
  const ctx = {
    player: { x: spawn.x, z: spawn.z, facing: spawn.facing ?? 0 },
    nurse: { x: first.x, z: first.z, facing: 0 },
  }
  const library = ((await load(`src/scenes/${scene}/cutscenes.ts`)).CUTSCENES ?? {}) as Record<
    string,
    (c: typeof ctx) => Old
  >
  const unlined: string[] = []
  const reordered: string[] = []
  const cutscenes = Object.keys(library)
    .sort()
    .map((id) => convert(id, (library[id] as (c: typeof ctx) => Old)(ctx), unlined, reordered))
  writeFileSync(
    join(import.meta.dirname, '../src/testing/fixtures', `${scene}.cutscenes.toml`),
    `# The adventure source's ${scene} cutscenes (provenance: the framework's docs/provenance/sources.md), converted once\n# by packages/cutscenes/scripts/convert-adventure-cutscenes.ts, each evaluated in one context. Do not edit.\n${stringify({ cutscenes } as never)}`,
  )
  console.log(
    `${scene}: ${cutscenes.length} cutscenes${unlined.length > 0 ? `, captions without a line left out: ${unlined.join(', ')}` : ''}${reordered.length > 0 ? `, keys put in time order: ${reordered.join(', ')}` : ''}`,
  )
}
console.log(`converted at ${commit}`)
