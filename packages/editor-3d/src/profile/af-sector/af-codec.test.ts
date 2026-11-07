// The codec of the native `af-sector/1` format (ED3D.1b step 3): the shipped depot reads, a patch of an unchanged
// model is byte-identical (ED3-q), an edit touches only its own bytes, and a new member or element lands where the
// format's order puts it.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { must } from '../../testing/edit-helpers'
import { loadAuthored } from '../../testing/fixtures'
import { changedRegion, literalEdits } from '../../testing/text-diff'
import { toyAfSector } from '../../testing/toy-af-sector'
import { afSectorCodec } from './af-codec'

const depotText = loadAuthored('depot.af-sector')

function parsed(text: string): AfSector {
  const result = afSectorCodec.parse(text)
  if (!result.ok) throw new Error(`does not parse: ${JSON.stringify(result.issues)}`)
  return result.value
}

function patched(text: string, before: AfSector, after: AfSector): string {
  const result = afSectorCodec.patch(text, before, after)
  if (!result.ok) throw new Error(`patch refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}

const withCeiling = (doc: AfSector, index: number, ceiling: number): AfSector => ({
  ...doc,
  sectors: doc.sectors.map((sector, i) => (i === index ? { ...sector, ceiling } : sector)),
})

const toyText = JSON.stringify(toyAfSector(), null, 2)

describe('the af-sector codec', () => {
  it('is named af-sector', () => {
    expect(afSectorCodec.id).toBe('af-sector')
  })

  it('reads the depot as the file says it, with no warning', () => {
    const result = afSectorCodec.parse(depotText)
    expect(result).toStrictEqual({ ok: true, value: JSON.parse(depotText) })
  })

  it('patches a model to itself byte for byte (ED3-q)', () => {
    const depot = parsed(depotText)
    expect(afSectorCodec.patch(depotText, depot, structuredClone(depot))).toStrictEqual({
      ok: true,
      text: depotText,
    })
  })

  it('changes one number in place when the hall ceiling moves, and puts the bytes back when it moves back', () => {
    const depot = parsed(depotText)
    const lowered = withCeiling(depot, 0, 3.5)
    const edited = patched(depotText, depot, lowered)
    expect(literalEdits(depotText, edited)).toEqual(['["sectors",0,"ceiling"]'])
    expect(changedRegion(depotText, edited)).toEqual({ removed: '4', added: '3.5' })
    expect(patched(edited, lowered, depot)).toBe(depotText)
  })

  it('inserts a new sector after the last one, in the layout of its neighbours, and nothing else moves', () => {
    const depot = parsed(depotText)
    const yard = {
      id: 'yard',
      floor: -1,
      ceiling: 4,
      light: 0.5,
      corners: [
        [14, 0],
        [18, 0],
        [18, 6],
        [14, 6],
      ],
    }
    const withYard = { ...depot, sectors: [...depot.sectors, yard] } as AfSector
    const edited = patched(depotText, depot, withYard)
    expect(changedRegion(depotText, edited).removed).toBe('')
    expect(parsed(edited)).toStrictEqual(withYard)
    const at = edited.indexOf('"id": "yard"')
    expect(at).toBeGreaterThan(edited.indexOf('"id": "dock"'))
    expect(at).toBeLessThan(edited.indexOf('"entityDefs"'))
    expect(edited.slice(edited.lastIndexOf('\n', at) + 1, at)).toBe('      ')
    expect(patched(edited, withYard, depot)).toBe(depotText)
  })

  it('puts a new top-level member where the format orders it, whatever is already there', () => {
    const depot = parsed(depotText)
    const styled = {
      ...depot,
      styles: { brick: { wallTexture: 'brick' } },
    } as AfSector
    const edited = patched(depotText, depot, styled)
    expect(Object.keys(JSON.parse(edited))).toEqual([
      'format',
      'name',
      'materials',
      'styles',
      'sectors',
      'entityDefs',
      'entities',
    ])
    expect(changedRegion(depotText, edited).removed).toBe('')

    const toy = parsed(toyText)
    const everything = {
      ...toy,
      entities: [{ def: 'spawn', id: 'spawn', x: 1, z: 1 }],
      entityDefs: [{ id: 'spawn', shape: 'point', fields: [] }],
      materials: { brick: { category: 'walls' } },
    } as AfSector
    expect(Object.keys(JSON.parse(patched(toyText, toy, everything)))).toEqual([
      'format',
      'name',
      'materials',
      'sectors',
      'entityDefs',
      'entities',
    ])
  })

  it('inserts a new instance by its id and removes one that is gone', () => {
    const depot = parsed(depotText)
    const crate2 = { def: 'crate', id: 'crate2', x: 12, z: 4, contents: 'empty' }
    const entities = [...(depot.entities ?? [])]
    const withCrate = { ...depot, entities: [...entities, crate2] } as AfSector
    const added = patched(depotText, depot, withCrate)
    expect(changedRegion(depotText, added).removed).toBe('')
    expect(parsed(added)).toStrictEqual(withCrate)

    const withoutSpawn = { ...depot, entities: entities.slice(1) } as AfSector
    const removed = patched(depotText, depot, withoutSpawn)
    expect(changedRegion(depotText, removed).added).toBe('')
    expect(parsed(removed)).toStrictEqual(withoutSpawn)
    expect(removed).not.toContain('"id": "spawn", "x"')
  })

  it('removes the first element of each id array by deleting its own bytes, not by rewriting the next one', () => {
    const depot = parsed(depotText)
    const without = (key: 'sectors' | 'entityDefs' | 'entities'): AfSector =>
      ({ ...depot, [key]: (depot[key] ?? []).slice(1) }) as AfSector
    for (const key of ['sectors', 'entityDefs', 'entities'] as const) {
      const edited = patched(depotText, depot, without(key))
      expect(changedRegion(depotText, edited).added, `${key}: only a deletion`).toBe('')
      expect(parsed(edited), `${key}: reads back`).toStrictEqual(without(key))
    }
  })

  it('matches elements by id: a removal beside an edit deletes one element and edits the other in place', () => {
    // The surviving elements are spaced as no printer would, so a diff that rewrote the first element into the
    // second (what a positional diff does) would show.
    const quirky = depotText
      .replace('[14, 0],', '[14,   0],')
      .replace('"size": [1, 1, 1]', '"size": [1,   1,   1]')
      .replace('"x": 11', '"x":   11')
    const depot = parsed(quirky)
    const lines = quirky.split('\n')
    const dropLine = (needle: string) => lines.filter((line) => !line.includes(needle)).join('\n')

    // sectors: the hall goes (its block of lines, up to the dock's), the dock's ceiling moves
    const hall = quirky.indexOf('    {\n      "id": "hall"')
    const dock = quirky.indexOf('    {\n      "id": "dock"')
    const sectorsAfter = {
      ...depot,
      sectors: [{ ...must(depot.sectors[1]), ceiling: 3 }],
    } as AfSector
    expect(patched(quirky, depot, sectorsAfter)).toBe(
      (quirky.slice(0, hall) + quirky.slice(dock)).replace(
        '"floor": -0.5,\n      "ceiling": 4',
        '"floor": -0.5,\n      "ceiling": 3',
      ),
    )

    // definitions: the spawn goes, the crate's size changes
    const defsAfter = {
      ...depot,
      entityDefs: [{ ...must(depot.entityDefs?.[1]), size: [2, 1, 1] }],
    } as AfSector
    expect(patched(quirky, depot, defsAfter)).toBe(
      dropLine('{"id": "spawn", "shape"').replace('[1,   1,   1]', '[2,   1,   1]'),
    )

    // instances: the spawn goes, the crate moves
    const entitiesAfter = {
      ...depot,
      entities: [{ ...must(depot.entities?.[1]), x: 12 }],
    } as AfSector
    expect(patched(quirky, depot, entitiesAfter)).toBe(
      dropLine('{"def": "spawn"').replace('"x":   11', '"x":   12'),
    )
  })

  it('puts a new member of a sector, a definition and an instance where the format orders it', () => {
    const depot = parsed(depotText)
    const edit = (
      key: 'sectors' | 'entityDefs' | 'entities',
      index: number,
      members: Record<string, unknown>,
    ): Record<string, unknown>[] => {
      const edited = JSON.parse(
        patched(depotText, depot, {
          ...depot,
          [key]: (depot[key] ?? []).map((item, i) => (i === index ? { ...item, ...members } : item)),
        } as AfSector),
      )
      return edited[key]
    }
    expect(Object.keys(must(edit('sectors', 0, { holes: [], open: true, style: 'plain' })[0]))).toEqual([
      'id',
      'floor',
      'ceiling',
      'light',
      'open',
      'style',
      'floorTexture',
      'wallTexture',
      'corners',
      'holes',
    ])
    expect(Object.keys(must(edit('entityDefs', 0, { label: 'Start', color: '#ff0000' })[0]))).toEqual([
      'id',
      'label',
      'shape',
      'single',
      'color',
      'fields',
    ])
    expect(Object.keys(must(edit('entities', 1, { y: 0.5 })[1]))).toEqual([
      'def',
      'id',
      'x',
      'y',
      'z',
      'contents',
    ])
  })

  it('puts a sector view after its light and open flag, and a wall occlude on its own corner and nothing else', () => {
    const depot = parsed(depotText)
    const [hall, ...rest] = depot.sectors
    const withView: AfSector = {
      ...depot,
      sectors: [{ ...must(hall), view: 'hall-view', open: true, style: 'plain' }, ...rest],
    }
    const viewText = patched(depotText, depot, withView)
    expect(Object.keys(must(JSON.parse(viewText).sectors[0]))).toEqual([
      'id',
      'floor',
      'ceiling',
      'light',
      'open',
      'view',
      'style',
      'floorTexture',
      'wallTexture',
      'corners',
    ])
    expect(patched(viewText, withView, depot)).toBe(depotText)
    const corner = must(must(hall).corners[0])
    const walled: AfSector = {
      ...depot,
      sectors: [
        {
          ...must(hall),
          corners: [
            [corner[0], corner[1], { ...corner[2], occlude: 'never' }],
            ...must(hall).corners.slice(1),
          ],
        },
        ...rest,
      ],
    }
    const walledText = patched(depotText, depot, walled)
    expect(JSON.parse(walledText).sectors[0].corners[0][2].occlude).toBe('never')
    expect(patched(walledText, walled, depot)).toBe(depotText)
  })

  it('keeps a member it does not know through an edit, on the file and on an instance', () => {
    const future = depotText
      .replace('"name": "depot",', '"name": "depot",\n  "editorState": {"zoom": 2},')
      .replace('"contents": "tools"', '"contents": "tools", "tint": "red"')
    const model = parsed(future)
    expect(model).toMatchObject({ editorState: { zoom: 2 } })
    expect(afSectorCodec.patch(future, model, structuredClone(model))).toStrictEqual({
      ok: true,
      text: future,
    })
    const edited = patched(future, model, withCeiling(model, 1, 3))
    expect(edited).toContain('"editorState": {"zoom": 2}')
    expect(edited).toContain('"tint": "red"')
    expect(literalEdits(future, edited)).toEqual(['["sectors",1,"ceiling"]'])
  })

  describe('versions', () => {
    const withFormat = (format: string) => depotText.replace('"af-sector/1"', `"${format}"`)

    it('opens af-sector/1 and af-sector/1.0 without a word', () => {
      expect(afSectorCodec.parse(withFormat('af-sector/1')).ok).toBe(true)
      expect(afSectorCodec.parse(withFormat('af-sector/1.0'))).toMatchObject({ ok: true })
      expect(afSectorCodec.parse(withFormat('af-sector/1.0'))).not.toHaveProperty('warnings')
    })

    it('opens a newer minor version with a warning at the format member, and keeps the value', () => {
      const result = afSectorCodec.parse(withFormat('af-sector/1.2'))
      expect(result).toMatchObject({
        ok: true,
        value: { format: 'af-sector/1.2', name: 'depot' },
        warnings: [{ path: ['format'] }],
      })
      expect(result.ok && result.warnings?.[0]?.message).toBe(
        'af-sector/1.2 is newer than af-sector/1: what this editor does not know is kept as written',
      )
    })

    it('refuses a newer major version at the format member', () => {
      expect(afSectorCodec.parse(withFormat('af-sector/2'))).toStrictEqual({
        ok: false,
        issues: [
          { path: ['format'], message: 'af-sector/2 is not a version this editor reads (af-sector/1)' },
        ],
      })
    })
  })

  it('fails a level of another format at the format member first', () => {
    const result = afSectorCodec.parse('{"scene": "x", "rooms": []}')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.issues[0]?.path).toEqual(['format'])
  })

  it('reads JSON that is not an object, and text that is not JSON, as one issue at the root', () => {
    expect(afSectorCodec.parse('[]')).toMatchObject({ ok: false, issues: [{ path: [] }] })
    expect(afSectorCodec.parse('{ "format": }')).toMatchObject({ ok: false, issues: [{ path: [] }] })
  })
})
