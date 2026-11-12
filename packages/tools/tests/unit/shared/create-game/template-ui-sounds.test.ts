import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'

// A new game's buttons sound from the first run: the game maps the interface's names to cues in its own Audio file,
// which the Audio editor opens and changes, and it ships in the framework's six languages.

let dir: string
const read = (path: string): string => readFileSync(join(dir, path), 'utf8')

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'af-template-ui-sounds-'))
  await Effect.runPromise(createGame({ targetDir: join(dir, 'game'), id: 'sound-game', title: 'Sound Game' }))
  dir = join(dir, 'game')
})
afterAll(() => rmSync(join(dir, '..'), { recursive: true, force: true }))

interface Voice {
  tone: string
  from: number
  to: number
  length: number
  volume: number
}
interface Cue {
  id: string
  about: string
  bus: string
  voices: Voice[]
}
const cues = (): Record<string, Cue> =>
  Object.fromEntries(
    (parse(read('content/audio/audio.toml')) as unknown as { cue: Cue[] }).cue.map((cue) => [cue.id, cue]),
  )

describe('the new game’s interface sounds', () => {
  it('maps every name the interface asks for to a cue of its own, played through the audio the game already runs', () => {
    const wiring = read('src/app/feel-audio.ts')
    expect(wiring).toContain('export const uiSounds')
    expect(wiring).toContain('`ui.${name}`')
    expect(wiring).toContain('sounds?.cue(')
  })

  it('hands the map and the six languages to defineGame', () => {
    const game = read('src/app/game.ts')
    expect(game).toContain('uiSounds,')
    expect(game).toContain("locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }")
    expect(game).toContain("import { DEFAULT_LOCALES } from '@automataframework/content/locale'")
  })

  it('has the three cues, on the interface bus, in the form the Audio editor opens', () => {
    const table = cues()
    for (const id of ['ui.press', 'ui.back', 'ui.focus']) {
      expect(table[id]?.bus, id).toBe('ui')
      expect(table[id]?.about, id).toMatch(/\S/)
    }
    expect(table['ui.press']?.voices).toEqual([
      { tone: 'square', from: 660, to: 660, length: 0.06, volume: 0.4 },
    ])
    expect(table['ui.back']?.voices).toEqual([
      { tone: 'square', from: 440, to: 330, length: 0.08, volume: 0.4 },
    ])
    expect(table['ui.focus']?.voices).toEqual([
      { tone: 'square', from: 880, to: 880, length: 0.025, volume: 0.2 },
    ])
  })

  it('keeps the bump cue and its event, so the game still answers a wall', () => {
    expect(cues()['bump']).toBeDefined()
    expect(read('content/audio/audio.toml')).toContain('on = "square.bumped"')
  })
})
