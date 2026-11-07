// The four scenes' converted cutscenes: 28 scripts that parse, whose captions name lines the scenes have, and
// the clinic's linted against the clinic map. The two findings left are the original's renderer rules: the keypad
// insert's camera is near a wall the renderer cuts away, and the opening's is above the clinic, outside the map.
import { resolveMap } from '@automata/sectors/sim'
import clinicMapToml from '@automata/sectors/testing/fixtures/clinic.sector-map.toml?raw'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { cutsceneSchema } from '#src/entries/sim.ts'
import { lintCutscenes } from '#src/entries/tools.ts'
import { SCENES, scriptsOf, textOf } from '#src/testing/converted-cutscenes.ts'

describe('the converted scenes', () => {
  it('have 5, 8, 8 and 7 scripts, each of which parses, with its id once', () => {
    expect(SCENES.map((s) => scriptsOf(s).length)).toEqual([5, 8, 8, 7])
    for (const scene of SCENES) {
      const scripts = scriptsOf(scene)
      for (const s of scripts) {
        const r = cutsceneSchema.safeParse(s)
        expect(r.success ? [] : r.error.issues, `${scene}/${s.id}`).toEqual([])
      }
      expect(new Set(scripts.map((s) => s.id)).size, scene).toBe(scripts.length)
    }
  })
  it('caption lines the scenes have, each in the scene’s own locale', () => {
    for (const scene of SCENES) {
      const text = textOf(scene)
      const missing = scriptsOf(scene).flatMap((s) =>
        (s.caption ?? []).filter((c) => text[c.line] === undefined).map((c) => `${s.id}: ${c.line}`),
      )
      expect(missing, scene).toEqual([])
    }
  })
  it('carry the original’s one-off marks as states, and its actors as the player and the nurse', () => {
    const power = scriptsOf('clinic').find((s) => s.id === 'power')
    expect(power?.states?.map((x) => x.state)).toContain('power')
    expect(new Set(scriptsOf('clinic').flatMap((s) => (s.actor ?? []).map((a) => a.who)))).toEqual(
      new Set(['player', 'nurse']),
    )
  })
})

describe('the clinic’s cutscenes against the clinic map', () => {
  const map = resolveMap(parse(clinicMapToml) as never)
  it('lint to the two renderer-dependent camera findings, and nothing else', () => {
    const found = lintCutscenes(scriptsOf('clinic'), {
      map,
      text: textOf('clinic'),
      sounds: new Set(['sting', 'power']),
      lamps: new Set(),
      anchor: () => undefined,
    })
    expect(found.map((f) => `${f.cutscene} ${f.rule}`).sort()).toEqual(['keypad camera', 'opening camera'])
  })
})
