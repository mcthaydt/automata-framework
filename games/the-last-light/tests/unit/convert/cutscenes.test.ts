import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { restageCutscenes } from '../../../tools/convert/cutscenes.ts'

// Two tiny scripts: one that starts on a mark, and a `found` that must follow where Ada was caught.
const TEXT = `[[cutscenes]]
id = "lightsOut"
duration = 4

[[cutscenes.actor]]
who = "player"
t = 0
x = -2.9
z = 0.7

[[cutscenes.caption]]
t = 0.8
until = 3
line = "prologue.cutscene.lightsOut.1"

[[cutscenes]]
id = "found"
duration = 7

[[cutscenes.camera]]
t = 0
pos = [ -3, 3.4, 5.8 ]
look = [ 0.6, 0.9, 3.6 ]

[[cutscenes.camera]]
t = 4.5
pos = [ -1, 2.6, -1.6 ]
look = [ -3.25, 0.75, 0.7 ]
cut = true

[[cutscenes.actor]]
who = "player"
t = 0
x = 0.6
z = 3.6

[[cutscenes.actor]]
who = "nurse"
t = 0
x = 0.13069499149142244
z = 2.832046349713237

[[cutscenes.actor]]
who = "nurse"
t = 4.5
x = 0
z = -6.1
cut = true

[[cutscenes.caption]]
t = 0
until = 7
line = "prologue.cutscene.found.1"
`

function scripts() {
  const { files, report } = restageCutscenes(TEXT, { lightsOut: { x: -2.9, z: 0.7 } })
  const byId = Object.fromEntries(
    Object.entries(files).map(([path, text]) => [path, parse(text) as Record<string, any>]),
  )
  return {
    byId: {
      lightsOut: byId['content/cutscenes/lights-out.toml'],
      found: byId['content/cutscenes/found.toml'],
    } as Record<string, any>,
    files,
    report,
  }
}

describe('restageCutscenes', () => {
  it('writes one file for each script, as the cutscene kind reads them', () => {
    expect(Object.keys(scripts().files).sort()).toEqual([
      'content/cutscenes/found.toml',
      'content/cutscenes/lights-out.toml',
    ])
    expect(scripts().byId.lightsOut).toMatchObject({ id: 'lightsOut', duration: 4 })
  })

  it('puts Ada on her mark with a cut, and keeps the caption’s line and timing', () => {
    const { byId } = scripts()
    expect(byId.lightsOut.actor[0]).toMatchObject({ who: 'player', x: -2.9, z: 0.7, cut: true })
    expect(byId.lightsOut.caption).toEqual([{ t: 0.8, until: 3, line: 'prologue.cutscene.lightsOut.1' }])
  })

  it('hangs found’s first shot off Ada, and leaves its second shot where it is', () => {
    const { byId } = scripts()
    expect(byId.found.camera[0]).toMatchObject({ about: 'player', pos: [-3.6, 3.4, 2.2], look: [0, 0.9, 0] })
    expect(byId.found.camera[1]).not.toHaveProperty('about')
    expect(byId.found.camera[1].pos).toEqual([-1, 2.6, -1.6])
  })

  it('stands Ada at herself and the figure at her own anchor, and leaves the figure’s exit alone', () => {
    const { byId } = scripts()
    expect(byId.found.actor[0]).toEqual({ who: 'player', t: 0, at: 'player' })
    expect(byId.found.actor[1]).toEqual({ who: 'nurse', t: 0, at: 'actor:nurse' })
    expect(byId.found.actor[2]).toMatchObject({ x: 0, z: -6.1, cut: true })
    expect(byId.found.caption[0]).toMatchObject({ t: 0, until: 7, line: 'prologue.cutscene.found.1' })
  })

  it('reports what it dropped from found', () => {
    expect(scripts().report).toContainEqual(
      expect.objectContaining({ kind: 'cutscene', where: 'found', did: 'dropped' }),
    )
  })
})
