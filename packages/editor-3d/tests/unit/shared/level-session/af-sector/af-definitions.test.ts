// How definitions are written into an `af-sector/1` level (ED3D.13a step 1): the access puts a definition where the
// file keeps it, `entityDefs`, and renames what its instances call it, and the codec turns that into the smallest patch.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afDefinitionAccess } from '#src/shared/level-session/af-sector/af-definitions.ts'
import { afEntityKit } from '#src/shared/level-session/af-sector/af-entities.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { ThingDef } from '#src/shared/things/thing-def.schema.ts'
import { must } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { changedRegion, literalEdits } from '#src/testing/text-diff.ts'

const depotText = loadAuthored('depot.af-sector')
const depot = ((): AfSector => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const defOf = (level: AfSector, id: string): ThingDef =>
  must(afEntityKit(level).definitions.find((def) => def.id === id))

const patched = (before: AfSector, after: AfSector, text = depotText): string => {
  const result = afSectorProfile.patch(text, before, after)
  if (!result.ok) throw new Error(`patch refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}

const barrel: ThingDef = { id: 'barrel', shape: 'box', size: [1, 1.2, 1], fields: [] }

describe('afDefinitionAccess', () => {
  it('lists every definition the file holds, readable or not', () => {
    const broken: AfSector = {
      ...depot,
      entityDefs: [...(depot.entityDefs ?? []), { id: 'bad', shape: 'cone' }],
    }
    expect(afDefinitionAccess.ids(depot)).toEqual(['spawn', 'crate'])
    expect(afDefinitionAccess.ids(broken)).toEqual(['spawn', 'crate', 'bad'])
    expect(afDefinitionAccess.ids({ ...depot, entityDefs: undefined })).toEqual([])
  })

  it('appends a definition to entityDefs, and the patch inserts that one element', () => {
    const next = afDefinitionAccess.add(depot, barrel)
    expect(next.entityDefs?.at(-1)).toEqual(barrel)
    expect(next.entityDefs?.slice(0, -1)).toEqual(depot.entityDefs)
    const text = patched(depot, next)
    const { removed, added } = changedRegion(depotText, text)
    expect(removed).toBe('')
    expect(added).toContain('"barrel"')
    expect(afSectorProfile.parse(text)).toEqual({ ok: true, value: next })
  })

  it('does not write a member that is undefined', () => {
    const next = afDefinitionAccess.add(depot, { ...barrel, label: undefined })
    expect(Object.keys(next.entityDefs?.at(-1) ?? {})).toEqual(['id', 'shape', 'size', 'fields'])
    const cleared = afDefinitionAccess.replace(depot, 'crate', { ...defOf(depot, 'crate'), size: undefined })
    expect(Object.keys(cleared.entityDefs?.[1] ?? {})).toEqual(['id', 'shape', 'fields'])
  })

  it('writes the first entityDefs of a file that has none', () => {
    const bare: AfSector = { ...depot, entityDefs: undefined }
    expect(afDefinitionAccess.add(bare, barrel).entityDefs).toEqual([barrel])
  })

  it('replaces a definition in its own place, its members in their own order, and is the level itself when nothing differs', () => {
    expect(afDefinitionAccess.replace(depot, 'crate', defOf(depot, 'crate'))).toBe(depot)
    const crate = defOf(depot, 'crate')
    const relabelled: ThingDef = { ...crate, fields: crate.fields, label: 'Crate', size: [2, 1, 1] }
    const next = afDefinitionAccess.replace(depot, 'crate', relabelled)
    expect(Object.keys(next.entityDefs?.[1] ?? {})).toEqual(['id', 'shape', 'size', 'fields', 'label'])
    expect(next.entityDefs?.[0]).toBe(depot.entityDefs?.[0])
    const text = patched(depot, next)
    expect(afSectorProfile.parse(text)).toEqual({ ok: true, value: next })
    expect(text).toContain('"size": [2, 1, 1]')
  })

  it('drops a member the new definition no longer has', () => {
    const { size: _size, ...rest } = defOf(depot, 'crate')
    const sized: ThingDef = {
      ...rest,
      fields: [...rest.fields, ...['w', 'h', 'd'].map((id) => ({ id, type: 'float' as const, default: 1 }))],
    }
    const next = afDefinitionAccess.replace(depot, 'crate', sized)
    expect(Object.keys(next.entityDefs?.[1] ?? {})).toEqual(['id', 'shape', 'fields'])
  })

  it('removes a definition and keeps the others as they were', () => {
    const next = afDefinitionAccess.remove(depot, 'crate')
    expect(next.entityDefs).toEqual([depot.entityDefs?.[0]])
    expect(next.entityDefs?.[0]).toBe(depot.entityDefs?.[0])
    expect(next.entities).toBe(depot.entities)
  })

  it('renames what the instances of a definition call it, in place, and leaves the rest alone', () => {
    const next = afDefinitionAccess.renameInstances(depot, 'crate', { def: 'box' })
    expect(next.entities?.[1]).toEqual({ def: 'box', id: 'crate1', x: 11, z: 2, contents: 'tools' })
    expect(next.entities?.[0]).toBe(depot.entities?.[0])
    expect(literalEdits(depotText, patched(depot, next))).toEqual(['["entities",1,"def"]'])
  })

  it('renames a member of each instance in its own place, and a patch rewrites only the key', () => {
    const next = afDefinitionAccess.renameInstances(depot, 'crate', {
      field: { from: 'contents', to: 'holds' },
    })
    expect(Object.keys(next.entities?.[1] ?? {})).toEqual(['def', 'id', 'x', 'z', 'holds'])
    const text = patched(depot, next)
    expect(afSectorProfile.parse(text)).toEqual({ ok: true, value: next })
    expect(text).toBe(depotText.replace('"contents": "tools"', '"holds": "tools"'))
  })

  it('is the level itself when no instance changes', () => {
    expect(afDefinitionAccess.renameInstances(depot, 'crate', {})).toBe(depot)
    expect(afDefinitionAccess.renameInstances(depot, 'nothing', { def: 'x' })).toBe(depot)
  })

  it('is the access of the af-sector profile', () => {
    expect(afSectorProfile.definitions).toBe(afDefinitionAccess)
  })
})
