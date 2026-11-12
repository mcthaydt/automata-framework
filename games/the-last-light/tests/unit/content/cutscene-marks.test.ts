import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'

// Three cutscenes put Ada on a mark and a fourth follows where she was caught (the plan's call 5). Each keeps every
// caption's line, its start and its end, and names the same lamps, doors, props and sounds as October's fixture, so the
// restaging changed where Ada stands and nothing the script says.

const ROOT = join(import.meta.dirname, '../../..')
type Row = Record<string, unknown>
type Script = { id: string; actor?: Row[]; camera?: Row[]; caption?: Row[] } & Record<
  string,
  Row[] | string | number | undefined
>
const scripts = (path: string) =>
  Object.fromEntries(
    (parse(readFileSync(path, 'utf8')) as { cutscenes: Script[] }).cutscenes.map((script) => [
      script.id,
      script,
    ]),
  )
/** The game's scripts: one file each, named for the script. */
const now = Object.fromEntries(
  readdirSync(join(ROOT, 'content/cutscenes')).map((name) => {
    const script = parse(readFileSync(join(ROOT, 'content/cutscenes', name), 'utf8')) as Script
    return [script.id, script]
  }),
)
const fixture = scripts(join(ROOT, '../../extensions/cutscenes/src/testing/fixtures/prologue.cutscenes.toml'))

const captions = (script: Script) => (script.caption ?? []).map((c) => [c.line, c.t, c.until])
/** Everything a script keys besides where people and the camera are: lamps, doors, props, sounds, states, fades, flicker. */
const namedThings = (script: Script) =>
  Object.entries(script)
    .filter(([key]) => !['id', 'actor', 'camera', 'caption', 'lintAllow'].includes(key))
    .map(([key, value]) => [key, value])

describe('the prologue’s cutscenes', () => {
  it('are the five of the fixture', () => {
    expect(Object.keys(now).sort()).toEqual(Object.keys(fixture).sort())
    expect(Object.keys(now).sort()).toEqual(['found', 'keypad', 'lightsOut', 'opening', 'rest'])
  })

  it.each(['opening', 'lightsOut', 'rest'])(
    '%s on a mark keeps each line, its timing and what it names',
    (id) => {
      expect(captions(now[id] as Script)).toEqual(captions(fixture[id] as Script))
      expect(namedThings(now[id] as Script)).toEqual(namedThings(fixture[id] as Script))
      expect((now[id] as Script).actor?.[0]).toMatchObject({ who: 'player', cut: true })
    },
  )

  it('opening starts at the spawn; lightsOut and rest at the bedside mark, not the nav node of that name', () => {
    expect((now.opening as Script).actor?.[0]).toMatchObject({ x: 0.6, z: 3.6 })
    expect((now.lightsOut as Script).actor?.[0]).toMatchObject({ x: -2.9, z: 0.7 })
    expect((now.rest as Script).actor?.[0]).toMatchObject({ x: -2.9, z: 0.7 })
  })

  it('found keeps its line and its timing, and follows where Ada was caught', () => {
    const found = now.found as Script
    expect(captions(found)).toEqual(captions(fixture.found as Script))
    expect(namedThings(found)).toEqual(namedThings(fixture.found as Script))
    expect(found.camera?.[0]).toMatchObject({ about: 'player' })
    // Before the cut to the bedside (4.5 s) Ada stands wherever she was caught; after it she is put on the bed.
    const before = (found.actor ?? []).filter((key) => key.who === 'player' && (key.t as number) < 4.5)
    expect(before.length).toBeGreaterThan(0)
    expect(before.every((key) => key.at === 'player')).toBe(true)
  })

  it('keypad is the fixture’s but for the lint allowance written by hand', () => {
    const { lintAllow: allowed, ...rest } = now.keypad as Script
    const { lintAllow: _was, ...before } = fixture.keypad as Script
    expect(rest).toEqual(before)
    expect(allowed).toEqual([expect.objectContaining({ rule: 'camera' })])
  })
})
