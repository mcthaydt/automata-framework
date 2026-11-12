import { levelAnchors, placeScript } from '@automata/cutscenes/sim'
import { lintCutscenes } from '@automata/cutscenes/tools'
import { level2dLintFloor } from '@automata/level-2d/sim'
import { systemsWarnings } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { project, startLevel } from '#src/features/level/level-content.ts'
import { lineOf, SCRIPTS, SYSTEMS, wordsOf } from '#src/features/story/story-content.ts'
import { METRE } from '#src/shared/constants.ts'

// What the story's content says about itself. `automata check` runs these with the game's other tests, so a person who
// moves the keeper in Levels, or edits a cutscene, is told in words when the two no longer fit. A game copies this file.

/** Every line key mapped to its words, as the caption reads them. */
const text = Object.fromEntries(
  Object.keys(
    Object.fromEntries(Object.values(SCRIPTS).flatMap((s) => (s.caption ?? []).map((c) => [c.line, 1]))),
  )
    .map((id) => [id, wordsOf(lineOf(id)?.text ?? '') ?? ''])
    .filter(([, words]) => words !== ''),
)

describe('the story’s cutscenes', () => {
  it('start the characters where Levels places them, stay on the floor and read well', () => {
    const found = lintCutscenes(Object.values(SCRIPTS), {
      map: level2dLintFloor({ level: startLevel, project, metre: METRE }),
      dimensions: 2,
      text,
      sounds: new Set(),
      lamps: new Set(),
      doors: new Set(),
      props: new Set(),
      anchor: levelAnchors(startLevel, METRE),
    })
    expect(found.map((f) => `${f.level} ${f.rule}: ${f.detail}`)).toEqual([])
  })
})

describe('the keeper’s cutscene', () => {
  it('starts him where Levels places him, so moving him in Levels moves the scene with him', () => {
    const moved = {
      ...startLevel,
      layers: startLevel.layers.map((layer) =>
        layer.kind === 'entities'
          ? {
              ...layer,
              items: layer.items.map((item) => (item.fields.name === 'keeper' ? { ...item, x: 104 } : item)),
            }
          : layer,
      ),
    }
    const gate = SCRIPTS.gate
    if (gate === undefined) throw new Error('the story has no "gate" cutscene')
    const placed = placeScript(gate, levelAnchors(moved, METRE))
    expect(placed.ok && placed.script.actor?.[0]).toMatchObject({ who: 'keeper', x: 6.5, z: 16 })
  })
})

describe('the story’s systems', () => {
  it('ask for nothing a 2D level cannot give', () => {
    expect(systemsWarnings(SYSTEMS, { flat: true, derived: [] })).toEqual([])
  })
})
