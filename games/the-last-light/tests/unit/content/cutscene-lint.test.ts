import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readLevel } from '@automata/3d/level'
import type { CutsceneScript } from '@automata/cutscenes/sim'
import { lintCutscenes } from '@automata/cutscenes/tools'
import { readSectorMap, resolveLevel } from '@automata/sectors/sim'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'

// The prologue's cutscenes against the prologue's level: the same lint the framework runs on every game's scripts
// (duration, captions long enough to read, shots, dead air, camera and actors against the walls, what a script names).

const ROOT = join(import.meta.dirname, '../../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const levelJson = JSON.parse(read('content/levels/prologue.af-sector.json')) as unknown
const level = readLevel(levelJson).level
const scripts = readdirSync(join(ROOT, 'content/cutscenes')).map(
  (name) => parse(read(`content/cutscenes/${name}`)) as unknown as CutsceneScript,
)
const words = Object.fromEntries(
  (parse(read('content/lines/prologue.toml')) as { lines: { id: string; words: string }[] }).lines.map(
    (line) => [line.id, line.words],
  ),
)

/** What a script names that the level must have. */
const named = (key: 'sound' | 'light' | 'door' | 'prop', field: string): Set<string> =>
  new Set(
    scripts.flatMap((script) =>
      ((script as unknown as Record<string, { [k: string]: string }[]>)[key] ?? []).map((row) =>
        String(row[field]),
      ),
    ),
  )

const spots = new Map((level.entities ?? []).map((entity) => [entity.id, { x: entity.x, z: entity.z }]))
/** Where an anchor stands for the lint: Ada at the spawn, the figure where she stood beside Ada, a hotspot where it is. */
const anchor = (name: string) =>
  name === 'player' ? spots.get('spawn') : name === 'actor:nurse' ? { x: 0.13, z: 2.83 } : spots.get(name)

describe('the prologue’s cutscenes against its level', () => {
  const found = lintCutscenes(scripts, {
    map: resolveLevel(readSectorMap(levelJson).level),
    text: words,
    sounds: named('sound', 'kind'),
    lamps: new Set((level.lamps ?? []).map((lamp) => lamp.id)),
    doors: new Set(
      level.sectors.flatMap((sector) => [sector.id, ...(sector.door === undefined ? [] : [sector.id])]),
    ),
    props: new Set((level.props ?? []).map((prop) => prop.id)),
    anchor,
  })

  it('has five scripts, each with its lines', () => {
    expect(scripts.map((script) => script.id).sort()).toEqual([
      'found',
      'keypad',
      'lightsOut',
      'opening',
      'rest',
    ])
  })

  it('lints to nothing the scripts have not allowed', () => {
    expect(
      found.map((finding) => `${finding.cutscene} ${finding.rule} (${finding.level}) ${finding.detail}`),
    ).toEqual([])
  })
})
