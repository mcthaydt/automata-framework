// The `hud` file is the hand-over to the coming UI editor: where each piece sits, how big it may be and which words it
// shows. A mistake in it is a sentence naming what is wrong, not a crash in play.
import { describe, expect, it } from 'vitest'
import { hudContent, hudSchema } from '#src/entries/content.ts'

const objective = { kind: 'objective', anchor: 'top' }
const prompt = { kind: 'prompt', anchor: 'bottom-right', width: 240, words: { label: 'hud.use' } }

const refusal = (file: unknown): string => {
  const read = hudSchema.safeParse(file)
  if (read.success) throw new Error('the file was accepted')
  return read.error.issues.map((issue) => issue.message).join('; ')
}

describe('the hud file', () => {
  it('reads pieces with a place, a width and the keys of their words', () => {
    const file = {
      pieces: [objective, prompt],
      objective: [
        { when: [{ has: 'key' }], line: 'objective.door', target: 'door' },
        { when: [], line: 'objective.look' },
      ],
    }
    expect(hudSchema.parse(file)).toEqual(file)
  })

  it('refuses a piece shown twice, naming it', () => {
    expect(refusal({ pieces: [objective, { ...objective, anchor: 'bottom' }] })).toMatch(/"objective".*once/)
  })

  it('refuses a place that is not on screen, and lists the places', () => {
    const said = refusal({ pieces: [{ kind: 'prompt', anchor: 'middle' }] })
    expect(said).toMatch(/"middle"/)
    expect(said).toMatch(/top-left/)
    expect(said).toMatch(/bottom-right/)
  })

  it('refuses a piece that is not one, and lists the pieces', () => {
    expect(refusal({ pieces: [{ kind: 'minimap', anchor: 'top' }] })).toMatch(/"minimap".*objective/)
  })

  it('refuses a width that is not above zero', () => {
    expect(refusal({ pieces: [{ ...prompt, width: 0 }] })).not.toBe('')
  })

  it('is a `hud` kind in the hud folder that the sim does not receive', () => {
    expect(hudContent.kind).toBe('hud')
    expect(hudContent.place).toEqual({ folder: 'hud' })
    expect(hudContent.sim).toBe(false)
  })
})
