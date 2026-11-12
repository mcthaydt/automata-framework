import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hudSchema } from '@automata/hud/content'
import type { Hotspot } from '@automata/interact/sim'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { hudModelOf, type PlayState } from '#src/app/play-state.ts'

// The HUD's model from what the sim reported this step: the objective line, the prompt (the nearest hotspot in reach,
// none in a cutscene), the items, what is held, an examine box, the keypad, and whether a cutscene holds input.

const file = hudSchema.parse(
  parse(readFileSync(join(import.meta.dirname, '../../../content/hud/play.toml'), 'utf8')),
)
const spot = (id: string, x: number): Hotspot => ({ id, x, z: 0, reach: 1, name: `hotspot.${id}` })

const START: PlayState = {
  facts: { noteRead: false, lit: false, fuel: 0 },
  items: [],
  held: undefined,
  inReach: [],
  examine: undefined,
  keypad: { open: false, digits: 4 },
  locked: false,
  hotspots: [spot('noticeboard', 3), spot('bed', -2)],
}

describe('hudModelOf', () => {
  it('shows the first objective at the start, and nothing else', () => {
    expect(hudModelOf(START, file)).toEqual({
      objective: 'prologue.objective.note',
      prompt: undefined,
      items: [],
      held: undefined,
      examine: undefined,
      keypad: { open: false, digits: 4 },
      locked: false,
    })
  })

  it('shows the hide objective after lights out', () => {
    expect(hudModelOf({ ...START, facts: { ...START.facts, lightsOut: true } }, file).objective).toBe(
      'prologue.objective.hide',
    )
  })

  it('prompts for the nearest hotspot in reach, by the key of its name', () => {
    const model = hudModelOf({ ...START, inReach: [spot('bed', -2), spot('noticeboard', 3)] }, file)
    expect(model.prompt).toEqual({ at: 'bed', name: 'hotspot.bed' })
  })

  it('has no prompt in a cutscene, and says the input is locked', () => {
    const model = hudModelOf({ ...START, inReach: [spot('bed', -2)], locked: true }, file)
    expect(model.prompt).toBeUndefined()
    expect(model.locked).toBe(true)
  })

  it('lists the items carried by the keys of their names and texts', () => {
    const model = hudModelOf({ ...START, items: ['handLamp', 'paraffin'], held: 'handLamp' }, file)
    expect(model.items).toEqual([
      { id: 'handLamp', name: 'prologue.item.handLamp.name', text: 'prologue.item.handLamp' },
      { id: 'paraffin', name: 'prologue.item.paraffin.name', text: 'prologue.item.paraffin' },
    ])
    expect(model.held).toBe('handLamp')
  })
})
