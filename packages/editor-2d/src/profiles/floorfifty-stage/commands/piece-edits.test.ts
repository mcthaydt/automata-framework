import { describe, expect, it } from 'vitest'
import { counterIds } from '../../../model/ids'
import { stageSchema } from '../stage.schema'
import { checkStage } from '../stage-checks'
import { printStage } from '../stage-codec'
import { layer, minimal, withLayers, withPieces } from '../testing/check-docs'
import { diffLines } from '../testing/diff-lines'
import { shippedStage } from '../testing/shipped-stages'
import { documentOf } from '../testing/stage-texts'
import { addSetPiece, moveSetPiece, removeSetPiece, type SetPieceKind, setSetPieceField } from './piece-edits'

// The Pieces view's edits (EDFF.1d step 5, spec §10.6): a set piece is a code-owned kind the stage picks and
// parameterises, placed on a floor of a fifty-floor race.

const KINDS: readonly SetPieceKind[] = ['lightsOut', 'paletteShift', 'weatherBurst', 'skyFlash', 'swarm']
const rooftops = (): ReturnType<typeof documentOf> => documentOf(shippedStage('rooftops'))
const floorsOf = (document: ReturnType<typeof minimal>): number[] =>
  document.value.theme.setPieces.map((piece) => piece.floor)

const piece = (floor: number): { floor: number; holdMs: number; kind: 'lightsOut' } => ({
  floor,
  holdMs: 5000,
  kind: 'lightsOut',
})
const three = (): ReturnType<typeof withPieces> =>
  withPieces([piece(10), piece(22), { floor: 45, holdMs: 6000, kind: 'paletteShift', mood: 'dawn' }])

describe('addSetPiece', () => {
  for (const kind of KINDS) {
    it(`adds a ${kind} piece that the schema accepts and the checks find nothing wrong with`, () => {
      const before = withLayers([
        layer('world.sky', 'sky', 0.06, { extend: 'plate' }),
        layer('world.clouds', 'sky', 0.06, { sink: -140, drift: 1 }),
        layer('world.near', 'city', 0.35),
      ])
      const after = addSetPiece(before, counterIds(), kind, 12)
      const added = after.value.theme.setPieces[0]
      expect(added?.kind).toBe(kind)
      expect(added?.floor).toBe(12)
      expect(stageSchema.safeParse(after.value).success).toBe(true)
      expect(checkStage(after).filter((finding) => finding.severity !== 'info')).toEqual([])
    })
  }

  it('starts each kind from the same values every time', () => {
    const before = withLayers([
      layer('world.sky', 'sky', 0.06, { extend: 'plate' }),
      layer('world.clouds', 'sky', 0.06),
    ])
    const start = (kind: SetPieceKind): unknown =>
      addSetPiece(before, counterIds(), kind, 12).value.theme.setPieces[0]
    expect(start('lightsOut')).toEqual({ floor: 12, holdMs: 6000, kind: 'lightsOut' })
    expect(start('paletteShift')).toEqual({ floor: 12, holdMs: 6000, kind: 'paletteShift', mood: 'night' })
    expect(start('weatherBurst')).toEqual({
      floor: 12,
      holdMs: 6000,
      kind: 'weatherBurst',
      particle: 'snow',
      density: 0.5,
    })
    expect(start('skyFlash')).toEqual({
      floor: 12,
      holdMs: 6000,
      kind: 'skyFlash',
      flashes: 1,
      tone: 'lightning',
    })
    expect(start('swarm')).toEqual({
      floor: 12,
      holdMs: 6000,
      kind: 'swarm',
      layers: ['world.clouds'],
      speed: 8,
    })
  })

  it('refuses an id the document already has', () => {
    expect(() => addSetPiece(three(), { next: () => 'b1' }, 'lightsOut', 3)).toThrow(RangeError)
  })

  it('gives a swarm the front sky layer that is not a plate, else the front layer, else none', () => {
    const swarmLayers = (document: ReturnType<typeof withLayers>): readonly string[] | undefined => {
      const added = addSetPiece(document, counterIds(), 'swarm', 5).value.theme.setPieces[0]
      return added?.kind === 'swarm' ? added.layers : undefined
    }
    expect(
      swarmLayers(
        withLayers([
          layer('world.sky', 'sky', 0.06, { extend: 'plate' }),
          layer('world.clouds', 'sky', 0.06),
          layer('world.birds', 'sky', 0.07),
          layer('world.near', 'city', 0.35),
        ]),
      ),
    ).toEqual(['world.birds'])
    expect(
      swarmLayers(
        withLayers([layer('world.sky', 'sky', 0.06, { extend: 'plate' }), layer('world.near', 'city', 0.35)]),
      ),
    ).toEqual(['world.near'])
    expect(swarmLayers(withLayers([]))).toEqual([])
  })

  it('takes an id from the source and puts it where the piece goes', () => {
    const after = addSetPiece(three(), counterIds(), 'lightsOut', 30)
    expect(after.ids.setPieces).toEqual(['b0', 'b1', '00000001', 'b2'])
  })

  it('keeps a list that is in floor order in floor order', () => {
    expect(floorsOf(addSetPiece(three(), counterIds(), 'lightsOut', 15))).toEqual([10, 15, 22, 45])
    expect(floorsOf(addSetPiece(three(), counterIds(), 'lightsOut', 5))).toEqual([5, 10, 22, 45])
    expect(floorsOf(addSetPiece(three(), counterIds(), 'lightsOut', 50))).toEqual([10, 22, 45, 50])
  })

  it('puts a piece after the others on its floor, so they play together in the order they were added', () => {
    expect(floorsOf(addSetPiece(three(), counterIds(), 'lightsOut', 22))).toEqual([10, 22, 22, 45])
    expect(addSetPiece(three(), counterIds(), 'skyFlash', 22).ids.setPieces).toEqual([
      'b0',
      'b1',
      '00000001',
      'b2',
    ])
  })

  it('works on a stage with no pieces, and leaves the other lists and the original alone', () => {
    const before = minimal()
    const after = addSetPiece(before, counterIds(), 'lightsOut', 3)
    expect(after.ids.layers).toBe(before.ids.layers)
    expect(after.ids.setPieces).toEqual(['00000001'])
    expect(before.value.theme.setPieces).toEqual([])
  })

  it('leaves a floor out of range for the checks', () => {
    const after = addSetPiece(minimal(), counterIds(), 'lightsOut', 51)
    expect(checkStage(after).map((finding) => finding.code)).toContain('setPieceRange')
  })

  it('prints as a new table, in the file’s style, after the pieces before it', () => {
    const base = shippedStage('rooftops')
    const edited = addSetPiece(rooftops(), counterIds(), 'paletteShift', 30)
    const text = printStage(base, edited)
    expect(documentOf(text).value).toEqual(edited.value)
    const diff = diffLines(base, text)
    expect(diff.removed).toEqual([])
    expect(diff.added.map((line) => line.text)).toEqual(
      expect.arrayContaining(['floor = 30', 'kind = "paletteShift"', 'holdMs = 6000', 'mood = "night"']),
    )
  })
})

describe('moveSetPiece', () => {
  it('changes the floor and nothing else, and the piece keeps its place in the list and its id', () => {
    const before = three()
    const after = moveSetPiece(before, 1, 40)
    expect(after.value.theme.setPieces[1]).toEqual({ ...before.value.theme.setPieces[1], floor: 40 })
    expect(floorsOf(after)).toEqual([10, 40, 45])
    expect(after.ids).toBe(before.ids)
    expect(after.value.theme.setPieces[0]).toBe(before.value.theme.setPieces[0])
  })

  it('is the same document for the floor it has', () => {
    const before = three()
    expect(moveSetPiece(before, 1, 22)).toBe(before)
  })

  it('refuses a piece that is not there', () => {
    expect(() => moveSetPiece(three(), 3, 5)).toThrow(RangeError)
    expect(() => moveSetPiece(three(), -1, 5)).toThrow(RangeError)
  })

  it('prints as the one line that holds the floor', () => {
    const base = shippedStage('rooftops')
    const diff = diffLines(base, printStage(base, moveSetPiece(rooftops(), 1, 23)))
    expect(diff.removed.map((line) => line.text)).toEqual(['floor = 22'])
    expect(diff.added.map((line) => line.text)).toEqual(['floor = 23'])
  })
})

describe('setSetPieceField', () => {
  const swarm = withPieces([
    { floor: 10, holdMs: 5000, kind: 'swarm', layers: ['world.clouds', 'world.birds'], speed: 8 },
  ])
  const burst = withPieces([
    { floor: 10, holdMs: 5000, kind: 'weatherBurst', particle: 'rain', density: 0.7 },
  ])

  it('sets a field the kind has', () => {
    const pieceOf = (document: ReturnType<typeof withPieces>): unknown => document.value.theme.setPieces[0]
    expect(pieceOf(setSetPieceField(swarm, 0, 'speed', 12))).toEqual({
      ...(pieceOf(swarm) as object),
      speed: 12,
    })
    expect(pieceOf(setSetPieceField(swarm, 0, 'holdMs', 9000))).toEqual({
      ...(pieceOf(swarm) as object),
      holdMs: 9000,
    })
    expect(pieceOf(setSetPieceField(swarm, 0, 'layers', ['world.birds']))).toEqual({
      ...(pieceOf(swarm) as object),
      layers: ['world.birds'],
    })
    expect(pieceOf(setSetPieceField(burst, 0, 'particle', 'snow'))).toEqual({
      ...(pieceOf(burst) as object),
      particle: 'snow',
    })
    expect(pieceOf(setSetPieceField(burst, 0, 'density', 0.2))).toEqual({
      ...(pieceOf(burst) as object),
      density: 0.2,
    })
  })

  it('sets the fields of the other kinds', () => {
    const lights = withPieces([piece(10)])
    expect(setSetPieceField(lights, 0, 'invert', true).value.theme.setPieces[0]).toEqual({
      ...piece(10),
      invert: true,
    })
    const palette = withPieces([{ floor: 10, holdMs: 5000, kind: 'paletteShift', mood: 'night' }])
    expect(setSetPieceField(palette, 0, 'mood', 'day').value.theme.setPieces[0]).toMatchObject({
      mood: 'day',
    })
    expect(setSetPieceField(palette, 0, 'stay', true).value.theme.setPieces[0]).toMatchObject({ stay: true })
    const flash = withPieces([{ floor: 10, holdMs: 5000, kind: 'skyFlash', flashes: 1, tone: 'lightning' }])
    expect(setSetPieceField(flash, 0, 'flashes', 3).value.theme.setPieces[0]).toMatchObject({ flashes: 3 })
    expect(setSetPieceField(flash, 0, 'tone', 'aurora').value.theme.setPieces[0]).toMatchObject({
      tone: 'aurora',
    })
    expect(setSetPieceField(flash, 0, 'kick', 2).value.theme.setPieces[0]).toMatchObject({ kick: 2 })
  })

  it('drops an optional field when given undefined', () => {
    const withKick = setSetPieceField(
      withPieces([{ floor: 10, holdMs: 5000, kind: 'skyFlash', flashes: 1, tone: 'lightning' }]),
      0,
      'kick',
      2,
    )
    const after = setSetPieceField(withKick, 0, 'kick', undefined)
    expect('kick' in (after.value.theme.setPieces[0] ?? {})).toBe(false)
    const dropped = setSetPieceField(
      setSetPieceField(burst, 0, 'layers', ['world.clouds']),
      0,
      'layers',
      undefined,
    )
    expect(dropped.value).toEqual(burst.value)
  })

  it('refuses a field the kind does not have, and no value for a field it needs', () => {
    expect(() => setSetPieceField(burst, 0, 'mood' as never, 'day' as never)).toThrow(
      'a weatherBurst piece has no mood',
    )
    expect(() => setSetPieceField(swarm, 0, 'layers', undefined)).toThrow('a swarm piece needs layers')
    expect(() => setSetPieceField(burst, 0, 'density', undefined as never)).toThrow('needs density')
    expect(() => setSetPieceField(burst, 0, 'holdMs', undefined as never)).toThrow('needs holdMs')
  })

  it('refuses a piece that is not there', () => {
    expect(() => setSetPieceField(swarm, 1, 'speed', 3)).toThrow(RangeError)
  })

  it('is the same document for the value it has', () => {
    expect(setSetPieceField(swarm, 0, 'speed', 8)).toBe(swarm)
    expect(setSetPieceField(burst, 0, 'layers', undefined)).toBe(burst)
  })

  it('leaves a value out of range for the checks', () => {
    const after = setSetPieceField(swarm, 0, 'speed', 99)
    expect(checkStage(after).map((finding) => finding.code)).toContain('setPieceRange')
  })
})

describe('removeSetPiece', () => {
  it('removes the piece and its id', () => {
    const after = removeSetPiece(three(), 1)
    expect(floorsOf(after)).toEqual([10, 45])
    expect(after.ids.setPieces).toEqual(['b0', 'b2'])
  })

  it('refuses a piece that is not there', () => {
    expect(() => removeSetPiece(three(), 3)).toThrow(RangeError)
  })

  it('prints the removal of a table and nothing else (FF-c)', () => {
    const base = shippedStage('rooftops')
    const edited = removeSetPiece(rooftops(), 0)
    const text = printStage(base, edited)
    expect(documentOf(text).value).toEqual(edited.value)
    expect(diffLines(base, text).added).toEqual([])
  })
})
