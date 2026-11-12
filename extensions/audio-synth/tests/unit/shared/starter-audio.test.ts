import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { audioSchema } from '#src/shared/audio.schema.ts'

// The audio file `automata create-game` gives a new game (`content/audio/audio.toml`) is what this editor opens, so it
// must be a valid `audio` table with the interface's three cues. The tools package, which writes it, may not import
// this package, so the check lives here and reads the template file by path.
const STARTER = new URL(
  '../../../../../packages/tools/src/shared/create-game/template-content/audio/audio.toml',
  import.meta.url,
)

describe('the starter audio file', () => {
  const table = audioSchema.parse(parse(readFileSync(STARTER, 'utf8')))

  it('is a valid audio table with the interface cues on the interface bus', () => {
    const cues = new Map((table.cue ?? []).map((cue) => [cue.id, cue]))
    for (const id of ['ui.press', 'ui.back', 'ui.focus']) expect(cues.get(id)?.bus, id).toBe('ui')
  })

  it('makes the focus tick half the level of the press', () => {
    const level = (id: string): number =>
      (table.cue ?? []).find((cue) => cue.id === id)?.voices[0]?.volume ?? 0
    expect(level('ui.press')).toBeGreaterThan(0)
    expect(level('ui.focus')).toBe(level('ui.press') / 2)
  })

  it('still answers the square bumping a wall', () => {
    expect((table.event ?? []).some((event) => event.on === 'square.bumped' && event.cue === 'bump')).toBe(
      true,
    )
  })
})
