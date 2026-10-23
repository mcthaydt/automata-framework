// The diff of spec §4.5, on the four shipped blockouts and small hand-formatted texts: the edits it makes are the
// edits the change needs and nothing else. Refusals are step 9 (patch.refusal.test.ts).
import { describe, expect, it } from 'vitest'
import { FIXTURE_NAMES, loadFixture } from '../testing/fixtures'
import { changedRegion, literalEdits } from '../testing/text-diff'
import { scan } from './locate'
import { type PatchRules, patchJson } from './patch'

const SCENES = ['blockout-clinic', 'blockout-clinic-dawn', 'blockout-bay', 'blockout-prologue'] as const

const ROOM_ORDER = ['id', 'zone', 'style', 'floor', 'ceiling', 'light', 'open', 'corners', 'holes']
const RULES: PatchRules = {
  idArrays: ['rooms', 'openings', 'boxes', 'hotspots', 'lamps', 'zones'],
  memberOrder: (path) => (path[0] === 'rooms' && path.length === 2 ? ROOM_ORDER : undefined),
}

// biome-ignore lint/suspicious/noExplicitAny: the models are untyped JSON that each test edits by path
type Model = Record<string, any>
const model = (text: string): Model => JSON.parse(text)

/** Patches `text` from the model it parses to into `edit(model)`, and returns the new text. */
function patched(text: string, edit: (model: Model) => void): string {
  const before = JSON.parse(text) as Model
  const after = structuredClone(before)
  edit(after)
  const result = patchJson(text, before, after, RULES)
  if (!result.ok) throw new Error(`refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  expect(JSON.parse(result.text), 'the new text reads as the new model').toEqual(after)
  return result.text
}

describe('patchJson on the shipped files', () => {
  for (const name of FIXTURE_NAMES) {
    it(`${name}: equal models give the same text`, () => {
      const text = loadFixture(name)
      const model = JSON.parse(text)
      const result = patchJson(text, model, structuredClone(model), RULES)
      expect(result).toStrictEqual({ ok: true, text })
    })
  }

  it('ED3-b: setting the clinic hall ceiling from 4.9 to 5.1 changes exactly that number', () => {
    const text = loadFixture('blockout-clinic')
    const out = patched(text, (model) => {
      model.rooms[0].ceiling = 5.1
    })
    expect(model(text).rooms[0].id).toBe('hall')
    expect(changedRegion(text, out)).toEqual({ removed: '4.9', added: '5.1' })
    // Undo: the previous model patched against the file as it now is gives the original bytes.
    const back = patchJson(out, model(out), model(text), RULES)
    expect(back).toStrictEqual({ ok: true, text })
  })

  for (const scene of SCENES) {
    it(`${scene}: a change to several rooms touches only the numbers that changed`, () => {
      const text = loadFixture(scene)
      const out = patched(text, (m) => {
        m.rooms[0].light = 1.5
        m.rooms[m.rooms.length - 1].ceiling += 0.25
        m.lamps[0].range = 2.25
      })
      expect(literalEdits(text, out)).toHaveLength(3)
    })
  }
})

describe('objects and maps, matched by key', () => {
  const text = '{\n  "anchors": {\n    "fuse": { "x": 1, "z": 2 },\n    "leak": { "x": 3, "z": 4 }\n  }\n}\n'

  it('changes a value with a literal edit', () => {
    const out = patched(text, (m) => {
      m.anchors.leak.z = 4.5
    })
    expect(literalEdits(text, out)).toEqual(['["anchors","leak","z"]'])
  })

  it('inserts a new key like its neighbours and removes a missing one', () => {
    const added = patched(text, (m) => {
      m.anchors.vent = { x: 5, z: 6 }
    })
    expect(added).toBe(text.replace('"z": 4 }\n', '"z": 4 },\n    "vent": { "x": 5, "z": 6 }\n'))
    const removed = patched(text, (m) => {
      delete m.anchors.fuse
    })
    expect(removed).toBe('{\n  "anchors": {\n    "leak": { "x": 3, "z": 4 }\n  }\n}\n')
  })

  it('puts a new key where the schema order says, not at the end', () => {
    const room =
      '{\n  "rooms": [\n    { "id": "a", "zone": "z", "floor": 0, "ceiling": 3, "corners": [[0, 0], [1, 0], [1, 1]] }\n  ]\n}\n'
    const out = patched(room, (m) => {
      m.rooms[0].light = 1
      m.rooms[0].style = 'COLD'
    })
    expect(Object.keys(model(out).rooms[0])).toEqual([
      'id',
      'zone',
      'style',
      'floor',
      'ceiling',
      'light',
      'corners',
    ])
  })

  it('removes and inserts in one patch, in either order of key', () => {
    const out = patched(text, (m) => {
      delete m.anchors.fuse
      delete m.anchors.leak
      m.anchors.vent = { x: 5, z: 6 }
    })
    expect(model(out)).toEqual({ anchors: { vent: { x: 5, z: 6 } } })
  })
})

describe('arrays whose elements carry an id', () => {
  it('inserts a new id at its position, removes a missing id, edits a changed element in place', () => {
    const text = loadFixture('blockout-clinic')
    const room = (id: string) => model(text).rooms.find((r: Model) => r.id === id)
    const inserted = patched(text, (m) => {
      m.rooms.splice(1, 0, { ...structuredClone(room('counter')), id: 'annex' })
    })
    expect(model(inserted).rooms.map((r: Model) => r.id)).toEqual([
      'hall',
      'annex',
      'counter',
      'ward',
      'mouth',
      'corridor',
      'doorway',
      'closet',
    ])
    expect(changedRegion(text, inserted).removed).toBe('')

    const removed = patched(text, (m) => {
      m.rooms = m.rooms.filter((r: Model) => r.id !== 'ward')
    })
    expect(changedRegion(text, removed).added).toBe('')
    expect(model(removed).rooms).toHaveLength(6)

    const edited = patched(text, (m) => {
      m.rooms[2].ceiling = 5
      m.rooms[2].light = 1.4
    })
    expect(literalEdits(text, edited)).toHaveLength(2)
  })

  it('mixes a removal at the front, an edit in the middle and an insert at the end in one patch', () => {
    const text = loadFixture('blockout-clinic')
    const out = patched(text, (m) => {
      m.rooms.shift()
      m.rooms[2].ceiling = 6
      m.rooms.push({ ...structuredClone(m.rooms[0]), id: 'extra' })
      m.rooms.splice(3, 0, { ...structuredClone(m.rooms[0]), id: 'between' })
    })
    expect(model(out).rooms.map((r: Model) => r.id)).toEqual([
      'counter',
      'ward',
      'mouth',
      'between',
      'corridor',
      'doorway',
      'closet',
      'extra',
    ])
  })

  it('diffs the same ids in another order by position, and still gives the new model', () => {
    const text = loadFixture('blockout-clinic')
    const out = patched(text, (m) => {
      const [first, second] = m.rooms
      m.rooms[0] = second
      m.rooms[1] = first
    })
    expect(
      model(out)
        .rooms.slice(0, 2)
        .map((r: Model) => r.id),
    ).toEqual(['counter', 'hall'])
  })

  it('treats an array named like an id array whose elements are not objects as positional', () => {
    const text = '{\n  "rooms": ["a", "b", "c"]\n}\n'
    expect(patched(text, (m) => m.rooms.splice(1, 1))).toBe('{\n  "rooms": ["a", "c"]\n}\n')
  })
})

describe('arrays diffed by position', () => {
  const rooms = (corners: string) => `{\n  "rooms": [\n    { "id": "a", "corners": ${corners} }\n  ]\n}\n`
  const base = rooms('[[0, 0], [4, 0], [4, 4], [0, 4]]')

  it('equal length: a moved corner changes only its two numbers', () => {
    const out = patched(base, (m) => {
      m.rooms[0].corners[2] = [5, 4.5]
    })
    expect(literalEdits(base, out)).toEqual(['["rooms",0,"corners",2,0]', '["rooms",0,"corners",2,1]'])
  })

  it('a removed corner removes one element, an added corner inserts one', () => {
    const removed = patched(base, (m) => {
      m.rooms[0].corners.splice(1, 1)
    })
    expect(removed).toBe(rooms('[[0, 0], [4, 4], [0, 4]]'))
    const added = patched(base, (m) => {
      m.rooms[0].corners.splice(2, 0, [4, 2])
    })
    expect(added).toBe(rooms('[[0, 0], [4, 0], [4, 2], [4, 4], [0, 4]]'))
  })

  it('one removed and two added: pairs the first, inserts the second', () => {
    const out = patched(base, (m) => {
      m.rooms[0].corners.splice(2, 1, [5, 3], [5, 5])
    })
    // The first two corners and the last stay byte for byte; [4,4] becomes [5,3] in place; [5,5] is inserted.
    expect(out).toBe(rooms('[[0, 0], [4, 0], [5, 3], [5, 5], [0, 4]]'))
    expect(
      literalEdits(
        base,
        patched(base, (m) => (m.rooms[0].corners[2] = [5, 3])),
      ),
    ).toEqual(['["rooms",0,"corners",2,0]', '["rooms",0,"corners",2,1]'])
  })

  it('two removed and three added: pairs two in place, inserts the third after them', () => {
    const out = patched(base, (m) => {
      m.rooms[0].corners.splice(1, 2, [3, 0], [5, 2], [4, 3])
    })
    expect(out).toBe(rooms('[[0, 0], [3, 0], [5, 2], [4, 3], [0, 4]]'))
  })

  it('a corner that gains a wall inserts the wall after its two numbers', () => {
    const out = patched(base, (m) => {
      m.rooms[0].corners[1] = [4, 0, { next: 'b' }]
    })
    expect(changedRegion(base, out)).toEqual({ removed: '', added: ', { "next": "b" }' })
  })

  it('a wall that changes from a string to an object is replaced whole, in the neighbours layout', () => {
    const text = rooms('[[0, 0, "north"], [4, 0, "north"], [4, 4]]')
    const out = patched(text, (m) => {
      m.rooms[0].corners[0][2] = { cut: 'north', thick: 0.5 }
    })
    const span = scan(text).node(['rooms', 0, 'corners', 0, 2])?.span
    expect(out.slice(0, span?.start)).toBe(text.slice(0, span?.start))
    expect(out.endsWith(text.slice(span?.end))).toBe(true)
    expect(out).toContain('{ "cut": "north", "thick": 0.5 }')
  })
})

describe('what a diff never touches', () => {
  it('keeps an unknown member of a changed room byte for byte', () => {
    const odd = '  "note":   { "keep":[1,   2], "me" : null }'
    const text = `{\n  "rooms": [\n    {\n      "id": "a",\n      "ceiling": 3,\n${odd.replace('  "note"', '      "note"')}\n    }\n  ]\n}\n`
    const out = patched(text, (m) => {
      m.rooms[0].ceiling = 3.5
    })
    expect(out).toBe(text.replace('"ceiling": 3,', '"ceiling": 3.5,'))
  })

  it('keeps float noise and hand precision out of the file: 0.1 + 0.2 is written as 0.3', () => {
    const text = '{\n  "a": 1\n}\n'
    expect(patched(text, () => {})).toBe(text)
    const result = patchJson(text, { a: 1 }, { a: 0.1 + 0.2 }, RULES)
    expect(result).toStrictEqual({ ok: true, text: '{\n  "a": 0.3\n}\n' })
  })

  it('keeps the text a file has when the new value is that value or rounds to exactly it', () => {
    const text = '{\n  "a": 0.12345\n}\n'
    const result = patchJson(text, { a: 0.12345 }, { a: 0.12345 + 1e-12 }, RULES)
    // 0.12345 prints as 0.1235 (round half up), which is not what is there, so this is an edit; the text a file
    // already has is kept only when the new value is exactly it or rounds to exactly it.
    expect(result.ok && JSON.parse(result.text).a).toBe(0.1235)
    expect(patchJson(text, { a: 0.12345 }, { a: 0.12345 }, RULES)).toStrictEqual({ ok: true, text })
    const four = '{\n  "a": 4.90\n}\n'
    expect(patchJson(four, { a: 4.9 }, { a: 4.9 + 1e-12 }, RULES)).toStrictEqual({ ok: true, text: four })
  })
})
