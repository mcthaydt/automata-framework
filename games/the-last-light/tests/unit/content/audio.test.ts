import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { content } from 'virtual:automata/content'
import { audioSchema, createMusicDirector, rowFor, stepCue } from '@automata/audio-synth'
import { navExtension } from '@automata/nav'
import { sectorsExtension } from '@automata/sectors'
import type { PluginDef } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'
import { createRuntime } from '#src/app/runtime.ts'
import { musicStateOf } from '#src/features/sound/music-state.ts'
import { soundEventsOf } from '#src/features/sound/sound-events.ts'
import { playRoute } from '#src/testing/bot.ts'
import { boot } from '#src/testing/harness.ts'
import { ROUTE } from '#src/testing/route.ts'

// The prologue's sound is a file, content/audio/audio.toml: the audio kind of @automata/audio-synth, which the Audio editor
// opens. These hold that every recorded file a cue names is shipped, that every event the sim can make has a row (a cue, or
// silent with its reason) and that the music follows the night as the old game's rules did.

const ROOT = join(import.meta.dirname, '../../..')
const audio = audioSchema.parse((content as { audio?: { audio?: unknown } }).audio?.audio)
const play = playOf(content)

/** Every event type the game's plugins can make: the sim's own, from each plugin that registers events. */
function pluginEvents(): string[] {
  const runtime = createRuntime(play)
  const plugins: readonly PluginDef[] = [
    ...[sectorsExtension, navExtension, ...runtime.extensions].flatMap((extension) => extension.sim ?? []),
    ...runtime.plugins,
  ]
  return plugins.flatMap((plugin) => plugin.events.map((event) => event.id))
}

describe('the recorded cues', () => {
  it('name a file that is shipped, and each shipped effect is named by a cue', () => {
    const files = (audio.cue ?? []).flatMap((cue) => (cue.sound === undefined ? [] : [cue.sound]))
    expect(files).toHaveLength(9)
    for (const file of files) expect(existsSync(join(ROOT, 'public', file)), file).toBe(true)
  })

  it('play at the level the old game scaled each file to (its `volume`, read at 92e6704)', () => {
    const gains = Object.fromEntries(
      (audio.cue ?? []).flatMap((cue) => (cue.sound === undefined ? [] : [[cue.id, cue.gain]])),
    )
    expect(gains).toEqual({
      openingWard: 0.3,
      cabinetOpen: 0.68,
      lampsOut: 4,
      pulseCounted: 3.63,
      nurseSettle: 4,
      nurseMoveOff: 4,
      turnToSound: 4,
      nurseSees: 4,
      nurseBackOff: 4,
    })
  })

  it('have no voices of their own, so the file is all that plays', () => {
    for (const cue of audio.cue ?? []) if (cue.sound !== undefined) expect(cue.voices).toEqual([])
  })
})

describe('the event rows', () => {
  it('answer every event type a plugin of the game can make', () => {
    const types = pluginEvents()
    expect(types.length).toBeGreaterThan(10)
    for (const type of types) expect(rowFor(audio, type), `no row for ${type}`).toBeDefined()
  })

  it('answer every derived name the content can make', () => {
    const wanted: string[] = []
    for (const script of play.scripts) wanted.push(`cutscene.${script.id}`)
    for (const agent of play.systems.agents ?? [])
      for (const mode of agent.modes) wanted.push(`agent.${agent.id}.${mode}`)
    for (const hotspot of play.hotspots) wanted.push(`use.${hotspot.id}`)
    wanted.push('use.combine', 'use.code', 'game.hide', 'noise.step', 'noise.buzz')
    for (const name of wanted) expect(rowFor(audio, name), `no row for ${name}`).toBeDefined()
  })

  it('name a cue the file defines, or say why they are silent', () => {
    const cues = new Set((audio.cue ?? []).map((cue) => cue.id))
    for (const row of audio.event ?? [])
      if (row.cue !== undefined) expect(cues.has(row.cue), `${row.on}: no cue ${row.cue}`).toBe(true)
      else expect(row.silent?.length, `${row.on} is silent with no reason`).toBeGreaterThan(10)
  })

  it('play the recorded effect for each of the figure’s modes and cutscenes the old game gave one', () => {
    const cueOf = (name: string): string | undefined => rowFor(audio, name)?.cue
    expect(cueOf('cutscene.opening')).toBe('openingWard')
    expect(cueOf('cutscene.keypad')).toBe('cabinetOpen')
    expect(cueOf('cutscene.rest')).toBe('lampsOut')
    expect(cueOf('cutscene.found')).toBe('pulseCounted')
    expect(cueOf('agent.nurse.dormant')).toBe('nurseSettle')
    expect(cueOf('agent.nurse.patrol')).toBe('nurseMoveOff')
    expect(cueOf('agent.nurse.investigate')).toBe('turnToSound')
    expect(cueOf('agent.nurse.hunt')).toBe('nurseSees')
    expect(cueOf('agent.nurse.flee')).toBe('nurseBackOff')
    // The lights-out cutscene's script plays its own sting; the old game played no file there.
    expect(rowFor(audio, 'cutscene.lightsOut')?.silent).toBeDefined()
  })

  it('sound something for a real run of the prologue, and never a cue the file lacks', async () => {
    const run = await playRoute(ROUTE, 1)
    const heard = [...run.events, ...soundEventsOf(run.events)].flatMap((event) => {
      const cue = rowFor(audio, event.type)?.cue
      return cue === undefined ? [] : [cue]
    })
    for (const expected of ['openingWard', 'cabinetOpen', 'lampsOut', 'door', 'pickup'])
      expect(heard, expected).toContain(expected)
  })

  it('buzz at a wrong code', async () => {
    const game = await boot()
    game.code('1234')
    const heard = soundEventsOf(game.log).flatMap((event) => rowFor(audio, event.type)?.cue ?? [])
    expect(heard).toContain('buzz')
  })
})

describe('the steps', () => {
  it('give every floor of the level a cue the file defines', () => {
    const cues = new Set((audio.cue ?? []).map((cue) => cue.id))
    for (const sector of play.map.sectors) {
      const cue = stepCue(audio.steps, (sector as { floorTexture?: string }).floorTexture)
      expect(cue !== undefined && cues.has(cue), `${sector.id}: ${cue}`).toBe(true)
    }
  })
})

describe('the music', () => {
  const director = () => createMusicDirector({ slots: audio.slot ?? [], rules: audio.music_rule ?? [] })
  const night = {
    paused: false,
    keypadOpen: false,
    inCutscene: false,
    lightsOut: false,
    figureMode: 'dormant',
    hidden: false,
  }
  const slotOf = (state: Partial<typeof night>): string | null =>
    director().step(musicStateOf({ ...night, ...state }), 0.1)

  it('is the first night while the lamps are on', () => {
    expect(slotOf({})).toBe('first-night')
  })

  it('is four-seventeen after lights out with the figure about', () => {
    expect(slotOf({ lightsOut: true, figureMode: 'patrol' })).toBe('four-seventeen')
  })

  it('is the practice chase while she hunts or follows', () => {
    expect(slotOf({ lightsOut: true, figureMode: 'hunt' })).toBe('back-to-bed-ada')
    expect(slotOf({ lightsOut: true, figureMode: 'follow' })).toBe('back-to-bed-ada')
  })

  it('goes silent while Ada hides, and holds what plays under the pause menu and the keypad', () => {
    expect(slotOf({ lightsOut: true, figureMode: 'hunt', hidden: true })).toBeNull()
    const held = director()
    expect(held.step(musicStateOf({ ...night, lightsOut: true, figureMode: 'patrol' }), 0.1)).toBe(
      'four-seventeen',
    )
    expect(held.step(musicStateOf({ ...night, paused: true }), 0.1)).toBe('four-seventeen')
    expect(held.step(musicStateOf({ ...night, keypadOpen: true }), 0.1)).toBe('four-seventeen')
  })

  it('names tracks the game ships: each slot is a file in public/music or falls back to one', () => {
    for (const slot of audio.slot ?? []) {
      const own = existsSync(join(ROOT, 'public/music', `${slot.sound ?? slot.id}.ogg`))
      const fallback = (slot.fallback ?? []).some((each) =>
        existsSync(join(ROOT, 'public/music', `${each.sound}.ogg`)),
      )
      expect(own || fallback, slot.id).toBe(true)
    }
  })
})
