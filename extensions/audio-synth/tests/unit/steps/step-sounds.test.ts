// Footsteps by floor: the audio file's `steps` table says which cue a step makes on which floor surface (a sector's
// `floorTexture`), with a default for a floor the table does not name. The game's view plays `stepCue(...)` when it hears
// its own step; the synth and the sim are unchanged.
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { type StepsTable, stepCue } from '#src/features/steps/step-sounds.ts'
import { audioSchema } from '#src/shared/audio.schema.ts'

const TABLE: StepsTable = { default: 'step', floors: { tile: 'stepTile', carpet: 'stepSoft' } }

describe('stepCue', () => {
  it('gives the cue of a floor that has a row', () => {
    expect(stepCue(TABLE, 'tile')).toBe('stepTile')
    expect(stepCue(TABLE, 'carpet')).toBe('stepSoft')
  })

  it('gives the default for a floor with no row, and for no floor at all', () => {
    expect(stepCue(TABLE, 'gravel')).toBe('step')
    expect(stepCue(TABLE, undefined)).toBe('step')
    expect(stepCue({ default: 'step' }, 'tile')).toBe('step')
  })

  it('gives nothing when the file has no table', () => {
    expect(stepCue(undefined, 'tile')).toBeUndefined()
  })

  it('does not take a name from the object’s own members', () => {
    expect(stepCue(TABLE, 'constructor')).toBe('step')
    expect(stepCue(TABLE, 'toString')).toBe('step')
  })
})

const cue = (id: string) =>
  `[[cue]]\nid = "${id}"\nbus = "sfx"\nvoices = [{ tone = "sine", from = 200, to = 100, length = 0.05, volume = 0.1 }]\n`
const file = (steps: string, cues: readonly string[] = ['step', 'stepTile', 'stepSoft']) =>
  `${cues.map(cue).join('\n')}\n${steps}`

describe('the `steps` table of the audio file', () => {
  it('is read, with its default and its floors', () => {
    const read = audioSchema.parse(
      parse(file('[steps]\ndefault = "step"\n[steps.floors]\ntile = "stepTile"\ncarpet = "stepSoft"\n')),
    )
    expect(read.steps).toEqual(TABLE)
  })

  it('is optional, and a file without it reads as before', () => {
    expect(audioSchema.parse(parse(file(''))).steps).toBeUndefined()
  })

  it('names the cue it needs when its default is not defined', () => {
    const read = audioSchema.safeParse(parse(file('[steps]\ndefault = "plod"\n')))
    expect(read.success).toBe(false)
    expect(read.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([
      'steps.default: no cue plod',
    ])
  })

  it('names the floor and the cue when a floor’s cue is not defined', () => {
    const read = audioSchema.safeParse(
      parse(file('[steps]\ndefault = "step"\n[steps.floors]\nmarble = "stepMarble"\n')),
    )
    expect(read.success).toBe(false)
    expect(read.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([
      'steps.floors.marble: no cue stepMarble for the floor marble',
    ])
  })

  it('refuses a table with no default', () => {
    expect(audioSchema.safeParse(parse(file('[steps]\n[steps.floors]\ntile = "stepTile"\n'))).success).toBe(
      false,
    )
  })
})
