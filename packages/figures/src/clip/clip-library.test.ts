import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Diagnostic } from '@automataframework/automata-content'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PoseDef } from '../pose/pose.schema'
import { compileFixture, FIXTURE_ROOT } from '../testing/compile-fixture'
import { FIXTURE_CLIP_IDS, fixtureClips } from '../testing/fixture-clips'
import type { FigureClipDef } from './clip.schema'
import { markerTime, retime, smoothTime, stepTime } from './clip-time'
import { clipWarnings } from './clip-warnings'
import { sample } from './sample'

const fileOf = (id: string): string => `content/figure-clips/${id}.toml`
const fixtureText = (id: string): string => readFileSync(join(FIXTURE_ROOT, fileOf(id)), 'utf8')

let clips: Record<string, FigureClipDef>
let poses: Record<string, PoseDef>
beforeAll(async () => {
  ;({ clips, poses } = await fixtureClips())
})
const clip = (id: string): FigureClipDef => {
  const found = clips[id]
  if (!found) throw new Error(`no fixture clip ${id}`)
  return found
}

describe('the fixture clips', () => {
  it('compile, and none changes space between keys', () => {
    expect(Object.keys(clips).sort()).toEqual([...FIXTURE_CLIP_IDS])
    for (const id of FIXTURE_CLIP_IDS) expect(clipWarnings(clip(id), poses), id).toEqual([])
  })
})

describe('I-i: retime, and the contact pose on the first frame at or after its marker', () => {
  it('retime scales key times, markers and cues evenly', () => {
    const jab = clip('jab')
    const slow = retime(jab, 0.6)
    const k = 0.6 / jab.length
    jab.keys.forEach((key, i) => {
      expect(slow.keys[i]?.t).toBeCloseTo(key.t * k, 12)
    })
    expect(markerTime(slow, 'contact')).toBeCloseTo(markerTime(jab, 'contact') * k, 12)
    slow.cues?.forEach((cue, i) => {
      expect(cue.t).toBeCloseTo((jab.cues?.[i]?.t ?? Number.NaN) * k, 12)
    })
  })
  it('with action lengths from 0.20 to 0.80 s and frames off the step grid, stepped and smooth', () => {
    for (let n = 20; n <= 80; n++) {
      const length = n / 100
      const played = retime(clip('jab'), length)
      const contact = markerTime(played, 'contact')
      const contactPose = sample(played, contact, poses)
      const rate = played.rate ?? 12
      // Render frames at 60 a second; the action starts `offset` after a frame (startedAt off the grid).
      for (const offset of [0, 0.004, 0.0111, 0.0163]) {
        const frames: number[] = []
        for (let f = 1; f / 60 - offset <= length + 1 / 60; f++)
          if (f / 60 >= offset) frames.push(f / 60 - offset)
        const first = frames.findIndex((t) => t >= contact)
        for (const mode of ['stepped', 'smooth'] as const) {
          const shown = frames.map((t, f) =>
            mode === 'stepped'
              ? stepTime(played, t, rate, frames[f - 1])
              : smoothTime(played, t, frames[f - 1]),
          )
          const label = `${mode}, length ${length}, offset ${offset}`
          expect(shown[first], label).toBe(contact)
          expect(sample(played, shown[first] ?? Number.NaN, poses), label).toEqual(contactPose)
          for (let f = 0; f < first; f++)
            expect(shown[f] ?? Number.NaN, `${label}, frame ${f}`).toBeLessThan(contact)
        }
      }
    }
  })
})

describe('I-j: a bad clip fails content compile at its location', () => {
  const lineOf = (text: string, needle: string): number =>
    text.slice(0, text.indexOf(needle)).split('\n').length
  async function failing(
    id: string,
    old: string,
    next: string,
  ): Promise<{ text: string; diagnostics: Diagnostic[] }> {
    const text = fixtureText(id)
    expect(text).toContain(old)
    const changed = text.replace(old, next)
    const result = await compileFixture({ [fileOf(id)]: changed })
    expect(result.ok).toBe(false)
    return { text: changed, diagnostics: result.ok ? [] : [...result.diagnostics] }
  }
  it('unsorted keys', async () => {
    const { text, diagnostics } = await failing('jab', 't = 0.25\nease = "in"', 't = 0.1\nease = "in"')
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        file: fileOf('jab'),
        line: lineOf(text, 't = 0.1\nease'),
        keyPath: 'keys.2.t',
      }),
    )
  })
  it('a key naming a missing pose', async () => {
    const { text, diagnostics } = await failing('raise-guard', 'pose = "guard-high"', 'pose = "guard-up"')
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'unknownReference',
        file: fileOf('raise-guard'),
        line: lineOf(text, 'pose = "guard-up"'),
        keyPath: 'keys.1.pose',
        message: 'no figure-pose has the id guard-up',
      }),
    ])
  })
  it('an unknown mask group', async () => {
    const { text, diagnostics } = await failing(
      'jab',
      'mask = [ "armR", "torso" ]',
      'mask = [ "armR", "tail" ]',
    )
    expect(diagnostics).toEqual([
      expect.objectContaining({ file: fileOf('jab'), line: lineOf(text, 'mask ='), keyPath: 'mask.1' }),
    ])
  })
  it('a marker outside the clip', async () => {
    const { text, diagnostics } = await failing('jab', 'contact = 0.25', 'contact = 0.9')
    expect(diagnostics).toEqual([
      expect.objectContaining({
        file: fileOf('jab'),
        line: lineOf(text, 'contact = 0.9'),
        column: 1,
        keyPath: 'markers.contact',
        message: expect.stringContaining('contact at 0.9 s is outside the clip'),
      }),
    ])
  })
})
