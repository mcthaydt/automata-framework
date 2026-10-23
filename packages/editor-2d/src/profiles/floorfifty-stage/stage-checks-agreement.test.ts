import { describe, expect, it } from 'vitest'
import { stageSchema } from './stage.schema'
import { checkStage } from './stage-checks'
import type { StageDocument } from './stage-document'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'
import { documentOf, insertElement, MINIMAL_STAGE, setAt, withList } from './testing/stage-texts'

// The schema is the oracle for the rules the checks restate (EDFF.1b decision 1). For single edits and seeded sequences
// of edits to the minimal stage and the four shipped ones, each within the types a command can produce (a number may be
// any number, NaN included; a required key is never missing), the checks report an error at a schema issue's path
// exactly when the schema refuses the value.

/** The codes of the rules the schema enforces; the course, alias, tuning and flash checks go beyond it. */
const SCHEMA_CODES = new Set([
  'id',
  'displayName',
  'emptyAlias',
  'noLayers',
  'layerRange',
  'plateOnlySky',
  'arcOnlyCity',
  'driftOnPlate',
  'plateFirst',
  'duplicateAlias',
  'layerOrder',
  'setPieceRange',
  'tooManyPieces',
  'phraseOrder',
  'phraseRange',
  'emptyPurpose',
  'purposeTooLong',
  'seedInvalid',
  'presentationRange',
])

type Pick = (count: number) => number

interface Edit {
  readonly name: string
  /** The edited document, or `undefined` when the document has nothing for this edit to change. */
  apply(document: StageDocument, pick: Pick): StageDocument | undefined
}

const record = (value: unknown): Record<string, unknown> => value as Record<string, unknown>
const theme = (document: StageDocument): Record<string, unknown> => record(document.value.theme)

/** An edit that sets one scalar of a table or list element, when that table or element exists. */
function setField(
  name: string,
  list: 'layers' | 'setPieces' | 'phrases' | 'extension',
  field: string,
  values: readonly unknown[],
  where?: (element: Record<string, unknown>) => boolean,
): Edit {
  return {
    name: `${name}`,
    apply(document, pick) {
      const elements: Record<string, unknown>[] =
        list === 'layers' || list === 'setPieces'
          ? (theme(document)[list] as Record<string, unknown>[])
          : ((record(document.value.course)?.[list] as Record<string, unknown>[] | undefined) ?? [])
      const candidates = elements
        .map((e, i) => [e, i] as const)
        .filter(([e]) => where === undefined || where(e))
      if (candidates.length === 0) return undefined
      const [, index] = candidates[pick(candidates.length)] as readonly [unknown, number]
      const base = list === 'layers' || list === 'setPieces' ? ['theme', list] : ['course', list]
      return setAt(document, [...base, index, field], values[pick(values.length)])
    },
  }
}

const NUMBERS = (...values: number[]): number[] => [...values, Number.NaN]

const EDITS: readonly Edit[] = [
  // identity and aliases
  ...[
    ['id', 'Bad Id'],
    ['id', ''],
    ['displayName', ''],
    ['displayName', 'x'.repeat(49)],
    ['platformAlias', ''],
    ['unlock', 'Bad Unlock'],
    ['unlock', ''],
    ['theme.backdropAlias', ''],
    ['theme.lightAlias', ''],
    ['theme.previewAlias', ''],
    ['theme.ambienceAlias', ''],
  ].map(
    ([path, value]): Edit => ({
      name: `${path} = ${JSON.stringify(value)}`,
      apply: (document) => setAt(document, (path as string).split('.'), value),
    }),
  ),
  // presentation
  ...(
    [
      ['refractionIntensity', 0.9],
      ['refractionIntensity', -0.1],
      ['horizonLift', 49],
      ['horizonLift', Number.NaN],
      ['lightHeight', 601],
      ['lightHeight', -201],
    ] as const
  ).map(
    ([field, value]): Edit => ({
      name: `presentation.${field} = ${value}`,
      apply: (document) =>
        document.value.theme.presentation === undefined
          ? undefined
          : setAt(document, ['theme', 'presentation', field], value),
    }),
  ),
  ...(['teach', 'combine', 'recover', 'finish'] as const).map(
    (phrase): Edit => ({
      name: `presentation.citySink.${phrase} out of range`,
      apply: (document, pick) =>
        document.value.theme.presentation?.citySink === undefined
          ? undefined
          : setAt(document, ['theme', 'presentation', 'citySink', phrase], [721, -1, Number.NaN][pick(3)]),
    }),
  ),
  // course
  {
    name: 'course.seed',
    apply: (document, pick) =>
      document.value.course === undefined
        ? undefined
        : setAt(document, ['course', 'seed'], [-1, 1.5, Number.NaN][pick(3)]),
  },
  {
    name: 'swap two phrases',
    apply(document) {
      const phrases = document.value.course?.phrases
      if (phrases === undefined) return undefined
      return setAt(document, ['course', 'phrases'], [phrases[1], phrases[0], ...phrases.slice(2)])
    },
  },
  {
    name: 'drop the last phrase',
    apply(document) {
      const phrases = document.value.course?.phrases
      return phrases === undefined ? undefined : setAt(document, ['course', 'phrases'], phrases.slice(0, -1))
    },
  },
  setField('phrase fromFloor', 'phrases', 'fromFloor', NUMBERS(0, 2.5, -4)),
  setField('phrase toFloor', 'phrases', 'toFloor', NUMBERS(0, 7.5, 1)),
  setField('phrase purpose', 'phrases', 'purpose', ['', 'x'.repeat(241), 'x'.repeat(240)]),
  setField('extension fromFloor', 'extension', 'fromFloor', NUMBERS(0, 2.5)),
  setField('extension toFloor', 'extension', 'toFloor', NUMBERS(0, 1)),
  setField('extension purpose', 'extension', 'purpose', ['', 'x'.repeat(241)]),
  // layers
  setField('layer depth', 'layers', 'depth', NUMBERS(1.5, -0.1, 0, 1, 0.5)),
  setField('layer sink', 'layers', 'sink', NUMBERS(5000, -900, 1440, -720)),
  setField('layer haze', 'layers', 'haze', NUMBERS(2, -1, 0.5)),
  setField('layer arc', 'layers', 'arc', NUMBERS(3, -1, 0.5, 2), (layer) => layer.plate === 'city'),
  setField('sky layer arc', 'layers', 'arc', [0.5, 0], (layer) => layer.plate === 'sky'),
  setField('layer drift', 'layers', 'drift', NUMBERS(4, -1, 0.5, 3)),
  setField('layer alias', 'layers', 'alias', ['', 'world.same']),
  setField('city layer plate', 'layers', 'extend', ['plate'], (layer) => layer.plate === 'city'),
  setField('layer plate', 'layers', 'plate', ['sky', 'city']),
  {
    name: 'swap two layers',
    apply(document, pick) {
      const layers = theme(document).layers as unknown[]
      if (layers.length < 2) return undefined
      const at = pick(layers.length - 1)
      const items = [...layers]
      const ids = [...document.ids.layers]
      ;[items[at], items[at + 1]] = [items[at + 1], items[at]]
      ;[ids[at], ids[at + 1]] = [ids[at + 1] as string, ids[at] as string]
      return withList(document, 'theme.layers', items, ids)
    },
  },
  {
    name: 'remove every layer',
    apply: (document) => withList(document, 'theme.layers', [], []),
  },
  // set pieces
  setField('piece floor', 'setPieces', 'floor', NUMBERS(0, 51, 2.5, 1, 50)),
  setField('piece holdMs', 'setPieces', 'holdMs', NUMBERS(100, 30_000, 1000.5, 500, 20_000)),
  setField('flashes', 'setPieces', 'flashes', NUMBERS(0, 4, 2.5, 1, 3), (piece) => piece.kind === 'skyFlash'),
  setField('kick', 'setPieces', 'kick', NUMBERS(9, -1, 0, 4), (piece) => piece.kind === 'skyFlash'),
  setField('density', 'setPieces', 'density', NUMBERS(2, -1, 0, 1), (piece) => piece.kind === 'weatherBurst'),
  setField('speed', 'setPieces', 'speed', NUMBERS(0, 21, 1, 20), (piece) => piece.kind === 'swarm'),
  setField(
    'piece layers',
    'setPieces',
    'layers',
    [[], ['a', 'b', 'c', 'd', 'e', 'f', 'g'], [''], ['a', ''], ['a', 'b', 'c', 'd', 'e', 'f']],
    (piece) => piece.kind === 'swarm' || piece.kind === 'weatherBurst',
  ),
  {
    name: 'seventeen pieces',
    apply(document) {
      let current = document
      while (current.value.theme.setPieces.length < 17)
        current = insertElement(
          current,
          'theme.setPieces',
          0,
          { floor: 5, kind: 'lightsOut', holdMs: 1000 },
          `n${current.value.theme.setPieces.length}`,
        )
      return current
    },
  },
]

// -- the sweep ---------------------------------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASES: readonly (readonly [string, StageDocument])[] = [
  ['minimal', documentOf(MINIMAL_STAGE)],
  ...SHIPPED_STAGE_IDS.map((id) => [id, documentOf(shippedStage(id))] as const),
]

/** `theme.layers[2].depth` as the checks write it: the index of a list the document gives ids to becomes the id. */
function checkPath(document: StageDocument, path: readonly PropertyKey[]): string {
  let text = ''
  path.forEach((step, i) => {
    if (typeof step === 'number') {
      const list = path.slice(0, i).join('.')
      const ids =
        list === 'theme.layers'
          ? document.ids.layers
          : list === 'theme.setPieces'
            ? document.ids.setPieces
            : list === 'course.extension'
              ? document.ids.extension
              : undefined
      text += `[${ids?.[step] ?? step}]`
    } else text += text === '' ? String(step) : `.${String(step)}`
  })
  return text
}

/** Compares the checks with the schema on one document; the message names the case. */
function agree(label: string, document: StageDocument): void {
  const verdict = stageSchema.safeParse(document.value)
  const findings = checkStage(document).filter(
    (finding) => finding.severity === 'error' && SCHEMA_CODES.has(finding.code),
  )
  if (verdict.success) {
    expect(findings, `${label}: the schema accepts it`).toEqual([])
    return
  }
  expect(findings.length, `${label}: the schema refuses it and the checks find nothing`).toBeGreaterThan(0)
  const paths = new Set(findings.map((finding) => finding.path))
  for (const issue of verdict.error.issues)
    expect(
      paths,
      `${label}: nothing at the schema's ${checkPath(document, issue.path)} (${issue.message})`,
    ).toContain(checkPath(document, issue.path))
}

describe('the checks agree with the schema', () => {
  it('finds nothing in the minimal stage and the four shipped ones', () => {
    for (const [name, document] of BASES) agree(name, document)
  })

  it.each(EDITS.map((edit) => [edit.name, edit] as const))(
    'on every base for the edit: %s',
    (_name, edit) => {
      let applied = 0
      for (const [baseName, base] of BASES)
        for (let attempt = 0; attempt < 6; attempt++) {
          const random = mulberry32(attempt + 1)
          const edited = edit.apply(base, (count) => Math.floor(random() * count))
          if (edited === undefined) continue
          applied += 1
          agree(`${edit.name} on ${baseName} (attempt ${attempt})`, edited)
        }
      expect(applied, 'the edit applied to at least one base').toBeGreaterThan(0)
    },
  )

  it('agrees on 600 seeded sequences of one to three edits', () => {
    const random = mulberry32(2026)
    const pick: Pick = (count) => Math.floor(random() * count)
    for (let run = 0; run < 600; run++) {
      const [baseName, base] = BASES[pick(BASES.length)] as readonly [string, StageDocument]
      let document = base
      const names: string[] = []
      for (let step = 1 + pick(3); step > 0; step--) {
        const edit = EDITS[pick(EDITS.length)] as Edit
        const edited = edit.apply(document, pick)
        if (edited === undefined) continue
        document = edited
        names.push(edit.name)
      }
      agree(`run ${run} on ${baseName} after ${names.join(', ') || 'no edits'}`, document)
    }
  })
})
