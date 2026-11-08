import { describe, expect, it } from 'vitest'
import { createTilesetsSession, type TilesetsSession } from '#src/features/tiles/tilesets-session.ts'
import { createHistory, type History } from '#src/shared/kit/history/history.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { AutoLayerDef, Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'
import type { Rule } from '#src/shared/level-2d/tiles/autotile/rule.schema.ts'

function open(): { history: History<unknown>; session: TilesetsSession } {
  const history = createHistory<unknown>(platformerTemplate.create(counterIds()))
  const session = createTilesetsSession({ history, ids: counterIds(500) })
  if (session === undefined) throw new Error('no session')
  return { history, session }
}

const ground = (history: History<unknown>): AutoLayerDef =>
  (history.state as Project).defs.layers.find((layer) => layer.id === 'ground') as AutoLayerDef
const ruleOf = (history: History<unknown>, id: string): Rule | undefined =>
  ground(history)
    .groups.flatMap((group) => group.rules)
    .find((rule) => rule.id === id)
const hazards = (history: History<unknown>): string[] =>
  ground(history)
    .groups.find((group) => group.id === 'hazards')
    ?.rules.map((rule) => rule.id) ?? []

/** Runs `edit` and says it added exactly one undo step with `label`. */
function oneStep(history: History<unknown>, label: string, edit: () => unknown): void {
  const before = history.revision
  expect(edit()).toEqual({ ok: true })
  expect(history.revision).toBe(before + 1)
  expect(history.undoLabel).toBe(label)
}

describe('the Tilesets session: selection', () => {
  it('opens on the first auto layer’s first rule and follows a choice', () => {
    const { session } = open()
    expect(session.selection).toMatchObject({
      tileset: 'terrain',
      layer: 'ground',
      group: 'terrain',
      value: 1,
    })
    session.select({ group: 'hazards' })
    expect(session.selection).toMatchObject({ group: 'hazards', rule: 'spike' })
    session.select({ rule: 'water' })
    expect(session.selection.rule).toBe('water')
  })

  it('toggles tiles on the sheet and tells subscribers', () => {
    const { session } = open()
    let told = 0
    session.subscribe(() => told++)
    session.toggleTile(4)
    session.toggleTile(2)
    session.toggleTile(4)
    expect(session.selection.tiles).toEqual([2])
    expect(told).toBe(3)
    session.clearTiles()
    expect(session.selection.tiles).toEqual([])
  })

  it('clears the tile selection when another tileset is shown, and keeps it for the same one', () => {
    const history = createHistory<unknown>(topdownRpgTemplate.create(counterIds()))
    const session = createTilesetsSession({ history, ids: counterIds(500) })
    const sets = (history.state as Project).defs.tilesets.map((set) => set.id)
    session?.toggleTile(1)
    session?.select({ tileset: sets[0] })
    expect(session?.selection.tiles).toEqual([1])
    const other: Project = {
      ...(history.state as Project),
      defs: {
        ...(history.state as Project).defs,
        tilesets: [
          ...(history.state as Project).defs.tilesets,
          {
            ...((history.state as Project).defs.tilesets[0] as Project['defs']['tilesets'][number]),
            id: 'other',
          },
        ],
      },
    }
    history.apply('Add tileset', () => other)
    session?.select({ tileset: 'other' })
    expect(session?.selection).toMatchObject({ tileset: 'other', tiles: [] })
  })

  it('is undefined for a document that is not a level project', () => {
    expect(
      createTilesetsSession({ history: createHistory<unknown>({ stage: 1 }), ids: counterIds() }),
    ).toBeUndefined()
  })
})

describe('the Tilesets session: rule edits, each one undo step', () => {
  it('cycles a pattern cell with the chosen value', () => {
    const { history, session } = open()
    session.select({ group: 'hazards', rule: 'spike', value: 4 })
    oneStep(history, 'Edit pattern', () => session.cycleCell(0))
    expect(ruleOf(history, 'spike')?.pattern).toEqual([{ not: 4 }])
  })

  it('resizes the pattern, sets the chance, flips, break, outside and on/off', () => {
    const { history, session } = open()
    session.select({ group: 'hazards', rule: 'spike' })
    oneStep(history, 'Resize pattern', () => session.resize(3))
    expect(ruleOf(history, 'spike')?.size).toBe(3)
    oneStep(history, 'Set chance', () => session.setChance(30))
    expect(ruleOf(history, 'spike')?.chance).toBe(0.3)
    oneStep(history, 'Flip X', () => session.setRule({ flipX: true }))
    oneStep(history, 'Flip Y', () => session.setRule({ flipY: true }))
    oneStep(history, 'Break on match', () => session.setRule({ breakOnMatch: true }))
    oneStep(history, 'Turn rule off', () => session.setRule({ active: false }))
    oneStep(history, 'Set outside', () => session.setOutside('same'))
    expect(ruleOf(history, 'spike')).toMatchObject({
      flipX: true,
      flipY: true,
      breakOnMatch: true,
      active: false,
      outside: 'same',
    })
    oneStep(history, 'Set outside', () => session.setOutside('3'))
    expect(ruleOf(history, 'spike')?.outside).toBe(3)
  })

  it('refuses a chance over 100% with the model’s message and adds no step', () => {
    const { history, session } = open()
    session.select({ group: 'hazards', rule: 'spike' })
    const before = history.revision
    const result = session.setChance(150)
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.message).toMatch(/chance/)
    expect(history.revision).toBe(before)
  })

  it('adds the selected tiles as outputs once each, and removes one', () => {
    const { history, session } = open()
    session.select({ group: 'hazards', rule: 'spike' })
    const first = ruleOf(history, 'spike')?.tiles[0]
    session.toggleTile(1)
    session.toggleTile(2)
    if (first !== undefined) session.toggleTile(first)
    oneStep(history, 'Add outputs', () => session.addOutputs())
    expect(ruleOf(history, 'spike')?.tiles).toEqual([first, 1, 2])
    oneStep(history, 'Remove output', () => session.removeOutput(0))
    expect(ruleOf(history, 'spike')?.tiles).toEqual([1, 2])
  })

  it('adds, duplicates and deletes rules, selecting the new one or the neighbour', () => {
    const { history, session } = open()
    session.select({ group: 'hazards', rule: 'water' })
    oneStep(history, 'Duplicate rule', () => session.duplicateRule())
    const copy = session.selection.rule ?? ''
    expect(hazards(history)).toEqual(['spike', 'water', copy, 'ladder', 'one-way'])
    expect(ruleOf(history, copy)).toEqual({ ...ruleOf(history, 'water'), id: copy })
    oneStep(history, 'Delete rule', () => session.deleteRule())
    expect(session.selection.rule).toBe('ladder')
    oneStep(history, 'Add rule', () => session.addRule())
    expect(hazards(history).at(-1)).toBe(session.selection.rule)
    expect(session.selection.rule).toMatch(/^rule-/)
  })

  it('reorders rules and groups', () => {
    const { history, session } = open()
    session.select({ group: 'hazards' })
    oneStep(history, 'Reorder rules', () => session.reorderRules(0, 2))
    expect(hazards(history)).toEqual(['water', 'ladder', 'spike', 'one-way'])
    oneStep(history, 'Reorder groups', () => session.reorderGroups(1, 0))
    expect(ground(history).groups.map((group) => group.id)).toEqual(['hazards', 'terrain'])
  })

  it('undo puts the rule back and the selection follows the data', () => {
    const { history, session } = open()
    session.select({ group: 'hazards', rule: 'water' })
    session.deleteRule()
    history.undo()
    expect(hazards(history)).toContain('water')
    expect(session.selection.rule).toBe('ladder')
    history.redo()
    expect(session.selection.rule).toBe('ladder')
  })
})

describe('the Tilesets session: groups and tags', () => {
  it('adds, renames, switches off and deletes a group', () => {
    const { history, session } = open()
    oneStep(history, 'Add group', () => session.addGroup())
    const added = session.selection.group ?? ''
    expect(ground(history).groups.at(-1)).toMatchObject({ id: added, label: 'Group 3', rules: [] })
    expect(session.selection.rule).toBeUndefined()
    oneStep(history, 'Rename group', () => session.editGroup({ label: 'Grass' }))
    oneStep(history, 'Turn group off', () => session.editGroup({ active: false }))
    expect(ground(history).groups.at(-1)).toMatchObject({ label: 'Grass', active: false })
    oneStep(history, 'Delete group', () => session.deleteGroup())
    expect(ground(history).groups.map((group) => group.id)).toEqual(['terrain', 'hazards'])
    expect(session.selection.group).toBe('terrain')
  })

  it('tags and untags the selected tiles, and makes a new tag from a name', () => {
    const { history, session } = open()
    const tags = () => (history.state as Project).defs.tilesets[0]?.tags ?? []
    session.toggleTile(3)
    session.toggleTile(5)
    oneStep(history, 'Tag tiles', () => session.newTag('lava'))
    expect(tags().find((entry) => entry.tag === 'lava')?.tiles).toEqual([3, 5])
    expect(session.selection.tag).toBe('lava')
    session.clearTiles()
    session.toggleTile(5)
    oneStep(history, 'Untag tiles', () => session.untagSelected())
    expect(tags().find((entry) => entry.tag === 'lava')?.tiles).toEqual([3])
    session.toggleTile(5)
    session.toggleTile(7)
    oneStep(history, 'Tag tiles', () => session.tagSelected())
    expect(tags().find((entry) => entry.tag === 'lava')?.tiles).toEqual([3, 7])
  })

  it('refuses a tag with no tiles selected or no name, in words', () => {
    const { session } = open()
    expect(session.newTag('lava')).toEqual({ ok: false, message: 'Select the tiles to tag first.' })
    session.toggleTile(1)
    expect(session.newTag('  ')).toEqual({ ok: false, message: 'Give the tag a name.' })
  })
})

describe('the Tilesets session: Add tiles', () => {
  const forest = {
    id: 'forest',
    label: 'Forest',
    image: 'assets/forest.png',
    imageSize: { w: 64, h: 32 },
    tile: { w: 16, h: 16 },
    spacing: 0,
    padding: 0,
    tags: [],
  }

  it('adds the tileset as one undo step and shows it, ready to paint with', () => {
    const { history, session } = open()
    oneStep(history, 'Add tiles', () => session.addTileset(forest))
    expect((history.state as Project).defs.tilesets.at(-1)).toEqual(forest)
    expect(session.selection.tileset).toBe('forest')
    expect(session.selection.tiles).toEqual([])
  })

  it('refuses a tileset the model refuses, with nothing added', () => {
    const { history, session } = open()
    const before = history.revision
    const done = session.addTileset({ ...forest, id: 'terrain' })
    expect(done.ok).toBe(false)
    expect(history.revision).toBe(before)
  })
})
