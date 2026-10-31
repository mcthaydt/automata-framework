// Acceptance cases of the definitions editor and New level (ED3D.13b; ED3D spec §13): ED3-q (New level from Home writes a
// valid `af-sector/1` file that opens) and ED3-r (add a definition with a field, place a thing of it, retype the field:
// refused with the instance named while it would stop validating; one undo per change).
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { addThing } from '../model/thing-edits'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { createTestClock, memoryWorkspace } from '../testing/memory-workspace'
import { createDefinitionsController } from './definitions-controller'
import { createEditorApp } from './editor-app'

describe('ED3-q: New level writes a level that opens', () => {
  it('creates a file in its own folder and opens it with a spawn definition, no sectors and no problems', async () => {
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    const app = createEditorApp({ workspace, clock })
    const made = await app.create('Pump House')
    expect(made).toEqual({ status: 'created', path: 'pump-house/pump-house.json' })
    const opened = await app.open('pump-house/pump-house.json')
    if (opened.status !== 'opened') throw new Error(`did not open: ${opened.status}`)
    expect(opened.level.profile.id).toBe('af-sector')
    const kit = opened.level.profile.entities(opened.level.editor.level)
    expect(kit.definitions.map((definition) => definition.id)).toEqual(['spawn'])
    expect(opened.level.profile.sectors.list(opened.level.editor.level)).toEqual([])
    expect(opened.level.checks.filter((check) => check.severity === 'error' && !check.ok)).toEqual([])
  })
})

describe('ED3-r: the definitions editor never makes an instance invalid', () => {
  const depot = ((): AfSector => {
    const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!result.ok) throw new Error('the depot does not parse')
    return result.value
  })()

  it('adds a lamp with a power field, places one, and refuses to retype power while it would not validate', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
    const definitions = createDefinitionsController(editor)
    expect(definitions.addDefinition({ id: 'lamp', shape: 'point' })).toBeUndefined()
    expect(definitions.addField('lamp', { id: 'power', type: 'int' })).toBeUndefined()
    const placed = editor.run(addThing({ def: 'lamp', id: 'lamp1', x: 4, z: 3, values: { power: 7 } }))
    expect(placed.ok).toBe(true)
    const refusal = definitions.changeField('lamp', 'power', { id: 'power', type: 'bool' })
    expect(refusal).toMatch(/lamp: power would stop validating: entity lamp1/)
    expect(definitions.view.definitions?.find((row) => row.id === 'lamp')?.fields[0]?.type).toBe('int')
    // Three changes, three undo steps: the thing, the field, the definition.
    editor.history.undo()
    editor.history.undo()
    editor.history.undo()
    expect(definitions.view.definitions?.some((row) => row.id === 'lamp')).toBe(false)
  })
})
