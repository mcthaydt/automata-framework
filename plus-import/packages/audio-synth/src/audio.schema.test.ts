// The `audio` content kind (M6.10a step 1, M6 spec §4.10): cues and beds as data, the event-to-cue map, the ducking rules and the
// music slots and rules. Each bad reference is reported at its path, so the content compiler names the file and line.
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { audioSchema } from './audio.schema'

const EXAMPLE = `
master_gain = 0.55

[[cue]]
id = "bang"
about = "The breaker blows: a low thump, a crack and the hiss after it."
bus = "sfx"
world = true
voices = [
  { tone = "sine", from = 90, to = 30, length = 0.6, volume = 0.8 },
  { hiss = 900, length = 0.4, volume = 0.6 },
  { hiss = [1800, 3800], at = 0.05, length = 0.04, volume = 0.15, q = 2 },
]

[[cue]]
id = "speech-tick"
bus = "ui"
no_duck = true
voices = [{ tone = "square", from = 1400, to = 1350, length = 0.03, volume = 0.012 }]

[[bed]]
id = "hum"
bus = "music"
volume = 0.035
drones = [{ wave = "sine", freq = 55 }, { wave = "sine", freq = 110.4, volume = 0.5 }]
noise = { freq = 400, q = 1, volume = 0.1 }
pulse = { rate = 2.4, depth = 0.6 }

[[event]]
on = "noise.bang"
cue = "bang"

[[event]]
on = "door.*"
silent = "its sound carries it"

[[duck]]
bus = "voice"
duck = ["music", "sfx"]
db = -9
attack = 0.08
release = 0.4

[[slot]]
id = "explore"
mode = "loop"
volume = 0.25
fallback = [{ sound = "explore-placeholder", volume = 0.8, filter = "radio" }]

[[slot]]
id = "chase"
mode = "loop"
volume = 0.4
linger = 5

[[music_rule]]
when = { scene = "clinic", pursuit = ["hunt", "follow"] }
slot = "chase"
why = "The chase."

[[music_rule]]
when = { scene = "clinic" }
slot = "explore"
why = "Exploration."
`
const paths = (value: unknown) => {
  const r = audioSchema.safeParse(value)
  return r.success ? [] : r.error.issues.map((i) => i.path)
}
const cue = { id: 'a', bus: 'sfx', voices: [{ tone: 'sine', from: 100, to: 50, length: 0.2, volume: 0.1 }] }

describe('audioSchema', () => {
  it('parses an example with every kind of row', () => {
    expect(paths(parse(EXAMPLE))).toEqual([])
  })
  it('parses an empty file', () => {
    expect(paths({})).toEqual([])
  })
  it('fails a voice that is neither a tone nor a hiss, or both', () => {
    expect(paths({ cue: [{ ...cue, voices: [{ length: 1, volume: 1 }] }] })).toEqual([
      ['cue', 0, 'voices', 0],
    ])
    expect(
      paths({
        cue: [{ ...cue, voices: [{ tone: 'sine', from: 1, to: 1, hiss: 100, length: 1, volume: 1 }] }],
      }),
    ).toEqual([['cue', 0, 'voices', 0]])
  })
  it('fails a tone with no sweep, an unknown wave and a bus core does not have', () => {
    expect(paths({ cue: [{ ...cue, voices: [{ tone: 'sine', length: 1, volume: 1 }] }] })).toEqual([
      ['cue', 0, 'voices', 0],
    ])
    expect(
      paths({ cue: [{ ...cue, voices: [{ tone: 'fuzz', from: 1, to: 1, length: 1, volume: 1 }] }] }),
    ).toEqual([['cue', 0, 'voices', 0, 'tone']])
    expect(paths({ cue: [{ ...cue, bus: 'effects' }] })).toEqual([['cue', 0, 'bus']])
  })
  it('fails a cue or bed id used twice, even across the two', () => {
    expect(paths({ cue: [cue, cue] })).toEqual([['cue', 1, 'id']])
    expect(
      paths({
        cue: [cue],
        bed: [{ id: 'a', bus: 'music', volume: 0.1, drones: [{ wave: 'sine', freq: 50 }] }],
      }),
    ).toEqual([['bed', 0, 'id']])
  })
  it('fails an event naming a cue that is not there, both a cue and a silence, or neither, or listed twice', () => {
    expect(paths({ cue: [cue], event: [{ on: 'x', cue: 'zzz' }] })).toEqual([['event', 0, 'cue']])
    expect(paths({ cue: [cue], event: [{ on: 'x', cue: 'a', silent: 'why' }] })).toEqual([['event', 0]])
    expect(paths({ event: [{ on: 'x' }] })).toEqual([['event', 0]])
    expect(
      paths({
        cue: [cue],
        event: [
          { on: 'x', cue: 'a' },
          { on: 'x', silent: 'why' },
        ],
      }),
    ).toEqual([['event', 1, 'on']])
  })
  it('fails a duck for a bus core does not have, and a slot used twice', () => {
    expect(paths({ duck: [{ bus: 'voice', duck: ['effects'], db: -9, attack: 0.1, release: 0.4 }] })).toEqual(
      [['duck', 0, 'duck', 0]],
    )
    expect(
      paths({
        slot: [
          { id: 's', mode: 'loop', volume: 1 },
          { id: 's', mode: 'once', volume: 1 },
        ],
      }),
    ).toEqual([['slot', 1, 'id']])
  })
  it('fails a music rule naming a slot that is not there, but not hold or silence', () => {
    const rule = (slot: string) => ({
      music_rule: [{ when: { scene: 'a' }, slot, why: 'x' }],
      slot: [{ id: 's', mode: 'loop', volume: 1 }],
    })
    expect(paths(rule('s'))).toEqual([])
    expect(paths(rule('hold'))).toEqual([])
    expect(paths(rule('silence'))).toEqual([])
    expect(paths(rule('zzz'))).toEqual([['music_rule', 0, 'slot']])
  })
})
