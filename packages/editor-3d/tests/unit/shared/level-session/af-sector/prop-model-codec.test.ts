// A prop's `model` and `fit` belong to the file, not to the editor: the codec reads them, an edit of another member leaves
// their bytes alone, and a patch of an unchanged model is byte-identical. (Choosing a model for a blockout is not built:
// it is a row of the editor gaps ledger.)

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'

const text = `${JSON.stringify(
  {
    format: 'af-sector/2',
    name: 'ward',
    sectors: [
      {
        id: 'hall',
        floor: { z: 0 },
        ceiling: { z: 3 },
        light: 1,
        corners: [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
        ],
      },
    ],
    props: [
      {
        id: 'bed',
        at: [1, 2],
        use: 'bed.single',
        angle: 180,
        model: 'models/bed.bin',
        fit: { scale: 0.9, offset: [0, 0.05, 0], turn: 90 },
      },
      { id: 'chair', at: [3, 3], kind: 'box' },
    ],
  },
  null,
  2,
)}\n`

function parsed(source: string): AfSector2File {
  const result = afSectorCodec.parse(source)
  if (!result.ok) throw new Error(`does not parse: ${JSON.stringify(result.issues)}`)
  return result.value
}

const patch = (source: string, before: AfSector2File, after: AfSector2File): string => {
  const result = afSectorCodec.patch(source, before, after)
  if (!result.ok) throw new Error(`patch refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}

describe('a prop that names a model, in the editor', () => {
  it('reads the model and its fit', () => {
    expect(parsed(text).props?.[0]).toMatchObject({
      model: 'models/bed.bin',
      fit: { scale: 0.9, offset: [0, 0.05, 0], turn: 90 },
    })
  })

  it('writes an unchanged model back byte for byte', () => {
    const model = parsed(text)
    expect(patch(text, model, model)).toBe(text)
  })

  it('keeps the model and the fit when another member of the prop is edited', () => {
    const before = parsed(text)
    const after: AfSector2File = {
      ...before,
      props: before.props?.map((prop) => (prop.id === 'bed' ? { ...prop, at: [1.5, 2] } : prop)),
    }
    const written = patch(text, before, after)
    expect(parsed(written).props?.[0]).toMatchObject({
      at: [1.5, 2],
      model: 'models/bed.bin',
      fit: { scale: 0.9, offset: [0, 0.05, 0], turn: 90 },
    })
    expect(written).toContain('"model": "models/bed.bin"')
  })

  it('keeps them when another prop is deleted', () => {
    const before = parsed(text)
    const after: AfSector2File = { ...before, props: before.props?.filter((prop) => prop.id === 'bed') }
    expect(parsed(patch(text, before, after)).props?.[0]).toMatchObject({ model: 'models/bed.bin' })
  })
})
