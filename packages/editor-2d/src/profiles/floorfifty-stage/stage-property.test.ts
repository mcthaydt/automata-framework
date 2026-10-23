import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import type { StageValue } from './stage.schema'
import { printStage } from './stage-codec'
import type { StageDocument } from './stage-document'
import type { ListName } from './stage-tables'
import { SHIPPED_STAGE_IDS, type ShippedStageId, shippedStage } from './testing/shipped-stages'
import {
  documentOf,
  insertElement,
  listOf,
  moveElement,
  removeAt,
  removeCourse,
  removeElement,
  setAt,
} from './testing/stage-texts'
import { findLine, scanBlocks, splitLines } from './toml-blocks'

// The property of the codec (EDFF.1a step 7, spec §10.3 rule 4): whatever sequence of edits a document goes through,
// the printed text reads back as that document, keeps the comments of every table and key that is still there exactly
// once, invents none, and does not pile up blank lines (by more than a removed key's gap). 200 seeded sequences of 1 to 8 edits for each shipped stage.

const SEQUENCES = 200

/** A small seeded generator (mulberry32), so a failing sequence can be replayed from its number. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Dice {
  next(): number
  below(n: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
  /** A number with at most three decimals in `[low, high]`. */
  number(low: number, high: number): number
}

function dice(seed: number): Dice {
  const next = random(seed)
  const below = (n: number): number => Math.floor(next() * n)
  return {
    next,
    below,
    pick: (items) => items[below(items.length)] as never,
    chance: (p) => next() < p,
    number: (low, high) => Math.round((low + next() * (high - low)) * 1000) / 1000,
  }
}

let fresh = 0
const freshId = (): string => `n${fresh++}`

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'quote " here', 'back \\ slash', 'ünïcode', 'plain']

function randomLayer(d: Dice): unknown {
  const city = d.chance(0.5)
  return {
    alias: `world.${d.pick(WORDS).replace(/\W/g, '')}${fresh}`,
    plate: city ? 'city' : 'sky',
    depth: d.number(0, 1),
    sink: d.number(-100, 100),
    ...(d.chance(0.5) ? { haze: d.number(0, 1) } : {}),
    extend: d.pick(['none', 'skirt', 'tile']),
  }
}

function randomPiece(d: Dice): unknown {
  const base = { floor: 1 + d.below(50), holdMs: 500 + d.below(5000) }
  switch (d.below(5)) {
    case 0:
      return { ...base, kind: 'lightsOut', ...(d.chance(0.5) ? { invert: d.chance(0.5) } : {}) }
    case 1:
      return {
        ...base,
        kind: 'paletteShift',
        mood: d.pick(['night', 'dawn', 'day']),
        ...(d.chance(0.5) ? { stay: true } : {}),
      }
    case 2:
      return {
        ...base,
        kind: 'weatherBurst',
        particle: d.pick(['snow', 'rain', 'bubble']),
        density: d.number(0, 1),
      }
    case 3:
      return { ...base, kind: 'skyFlash', flashes: 1 + d.below(3), tone: d.pick(['lightning', 'aurora']) }
    default:
      return { ...base, kind: 'swarm', layers: [d.pick(WORDS).replace(/\W/g, '')], speed: 1 + d.below(19) }
  }
}

const randomExtension = (d: Dice): unknown => ({
  fromFloor: 20,
  toFloor: 20 + d.below(20),
  purpose: d.pick(WORDS),
})

function randomPresentation(d: Dice): unknown {
  return {
    profile: 'aquarian',
    refractionIntensity: d.number(0, 0.8),
    horizonLift: d.number(0, 48),
    ...(d.chance(0.5) ? { lightHeight: d.number(-100, 100) } : {}),
    ...(d.chance(0.5) ? { citySink: randomCitySink(d) } : {}),
  }
}

const randomCitySink = (d: Dice): unknown => ({
  teach: d.number(0, 700),
  combine: d.number(0, 700),
  recover: d.number(0, 700),
  finish: d.number(0, 700),
})

function randomCourse(d: Dice): { course: unknown; extensionCount: number } {
  const extensionCount = d.below(3)
  return {
    course: {
      seed: d.below(100000),
      phrases: ['teach', 'combine', 'recover', 'finish'].map((name, i) => ({
        name,
        fromFloor: 1 + i * 5,
        toFloor: 5 + i * 5,
        purpose: d.pick(WORDS),
      })),
      ...(extensionCount > 0
        ? { extension: Array.from({ length: extensionCount }, () => randomExtension(d)) }
        : {}),
    },
    extensionCount,
  }
}

const count = (document: StageDocument, list: ListName): number => listOf(document, list).items.length

const EDIT_NAMES = [
  'displayName',
  'seed',
  'layer sink',
  'layer haze',
  'piece hold',
  'phrase purpose',
  'unlock',
  'light alias',
  'tunable',
  'remove layer',
  'insert layer',
  'remove piece',
  'insert piece',
  'move layer',
  'move piece',
  'remove or insert extension',
  'move extension',
  'toggle presentation',
  'toggle city sink',
  'toggle course',
]

/** The edits of the sequence being built, for the message of a failure. */
const trace: string[] = []

/** One random edit of a document: a scalar, an optional key, an element, or a whole table. */
function randomEdit(d: Dice, doc: StageDocument): StageDocument {
  const layers = count(doc, 'theme.layers')
  const pieces = count(doc, 'theme.setPieces')
  const extensions = count(doc, 'course.extension')
  const hasCourse = doc.value.course !== undefined
  const presentation = doc.value.theme.presentation
  const kind = d.below(20)
  trace.push(EDIT_NAMES[kind] as string)
  switch (kind) {
    case 0:
      return setAt(doc, ['displayName'], d.pick(WORDS))
    case 1:
      return hasCourse ? setAt(doc, ['course', 'seed'], d.below(100000)) : doc
    case 2:
      return setAt(doc, ['theme', 'layers', d.below(layers), 'sink'], d.number(-100, 100))
    case 3: {
      const path = ['theme', 'layers', d.below(layers), 'haze'] as const
      return doc.value.theme.layers[path[2]]?.haze === undefined
        ? setAt(doc, path, d.number(0, 1))
        : removeAt(doc, path)
    }
    case 4:
      return pieces > 0
        ? setAt(doc, ['theme', 'setPieces', d.below(pieces), 'holdMs'], 500 + d.below(5000))
        : doc
    case 5:
      return hasCourse ? setAt(doc, ['course', 'phrases', d.below(4), 'purpose'], d.pick(WORDS)) : doc
    case 6:
      return doc.value.unlock === undefined
        ? setAt(doc, ['unlock'], `unlock-${d.below(9)}`)
        : removeAt(doc, ['unlock'])
    case 7:
      return doc.value.theme.lightAlias === undefined
        ? setAt(doc, ['theme', 'lightAlias'], 'world.moon')
        : removeAt(doc, ['theme', 'lightAlias'])
    case 8: {
      const name = `tunable${d.below(3)}`
      return name in doc.value.courseTuning && d.chance(0.5)
        ? removeAt(doc, ['courseTuning', name])
        : setAt(doc, ['courseTuning', name], d.number(0, 10))
    }
    case 9:
      return layers > 1 ? removeElement(doc, 'theme.layers', d.below(layers)) : doc
    case 10:
      return insertElement(doc, 'theme.layers', d.below(layers + 1), randomLayer(d), freshId())
    case 11:
      return pieces > 0 ? removeElement(doc, 'theme.setPieces', d.below(pieces)) : doc
    case 12:
      return insertElement(doc, 'theme.setPieces', d.below(pieces + 1), randomPiece(d), freshId())
    case 13:
      return layers > 1 ? moveElement(doc, 'theme.layers', d.below(layers), d.below(layers)) : doc
    case 14:
      return pieces > 1 ? moveElement(doc, 'theme.setPieces', d.below(pieces), d.below(pieces)) : doc
    case 15:
      if (!hasCourse) return doc
      return d.chance(0.5) && extensions > 0
        ? removeElement(doc, 'course.extension', d.below(extensions))
        : insertElement(doc, 'course.extension', d.below(extensions + 1), randomExtension(d), freshId())
    case 16:
      return extensions > 1
        ? moveElement(doc, 'course.extension', d.below(extensions), d.below(extensions))
        : doc
    case 17:
      return presentation === undefined
        ? setAt(doc, ['theme', 'presentation'], randomPresentation(d))
        : removeAt(doc, ['theme', 'presentation'])
    case 18:
      if (presentation === undefined) return doc
      return presentation.citySink === undefined
        ? setAt(doc, ['theme', 'presentation', 'citySink'], randomCitySink(d))
        : removeAt(doc, ['theme', 'presentation', 'citySink'])
    default: {
      if (hasCourse) return removeCourse(doc)
      const { course, extensionCount } = randomCourse(d)
      const withCourse = setAt(doc, ['course'], course)
      return {
        ...withCourse,
        ids: { ...withCourse.ids, extension: Array.from({ length: extensionCount }, freshId) },
      }
    }
  }
}

// -- the invariants ----------------------------------------------------------------------------------------------

const commentLines = (lines: readonly string[]): string[] =>
  lines.filter((line) => line.trimStart().startsWith('#')).sort()

/** The comment lines inside the tables of the base that the final document no longer has. */
function lostComments(base: string, baseDoc: StageDocument, finalDoc: StageDocument): string[] {
  const { lines } = splitLines(base)
  const seen = new Map<string, number>()
  const lost: string[] = []
  for (const block of scanBlocks(lines)) {
    const index = seen.get(block.name) ?? 0
    seen.set(block.name, index + 1)
    const list =
      block.name === 'course.extension'
        ? 'extension'
        : block.name === 'theme.layers'
          ? 'layers'
          : block.name === 'theme.setPieces'
            ? 'setPieces'
            : undefined
    const gone =
      list !== undefined
        ? !finalDoc.ids[list].includes(baseDoc.ids[list][index] as string)
        : block.name === 'course' || block.name === 'course.phrases'
          ? finalDoc.value.course === undefined
          : block.name === 'theme.presentation'
            ? finalDoc.value.theme.presentation === undefined
            : block.name === 'theme.presentation.citySink'
              ? finalDoc.value.theme.presentation?.citySink === undefined
              : false
    if (gone) lost.push(...commentLines(lines.slice(block.start, block.last + 1)))
  }
  return lost
}

type Path = (string | number)[]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The paths of the keys the base has and the final document lacks, inside tables both have. The elements of the three
 * lists are matched by id, the four phrases by position.
 */
function removedKeys(baseDoc: StageDocument, finalDoc: StageDocument): Path[] {
  const out: Path[] = []
  const walk = (base: unknown, final: unknown, path: Path): void => {
    if (!isObject(base) || !isObject(final)) return
    for (const [key, child] of Object.entries(base)) {
      const there = final[key]
      if (child === undefined) continue
      if (there === undefined) {
        // A table that went is `lostComments`' business, with all its comments; a key is a line.
        if (!isObject(child) && !(Array.isArray(child) && child.some(isObject))) out.push([...path, key])
        continue
      }
      const here = [...path, key]
      const joined = here.join('.')
      if (joined === 'theme.layers') matchById(child, there, 'layers', here)
      else if (joined === 'theme.setPieces') matchById(child, there, 'setPieces', here)
      else if (joined === 'course.extension') matchById(child, there, 'extension', here)
      else if (joined === 'course.phrases') {
        for (const [i, phrase] of (child as unknown[]).entries())
          walk(phrase, (there as unknown[])[i], [...here, i])
      } else walk(child, there, here)
    }
  }
  const matchById = (base: unknown, final: unknown, list: keyof StageDocument['ids'], path: Path): void => {
    for (const [i, id] of baseDoc.ids[list].entries()) {
      const j = finalDoc.ids[list].indexOf(id)
      if (j >= 0) walk((base as unknown[])[i], (final as unknown[])[j], [...path, i])
    }
  }
  walk(baseDoc.value, finalDoc.value, [])
  return out
}

/** The comment lines directly above the keys that were removed from tables that stay: a comment goes with its key. */
function lostKeyComments(base: string, baseDoc: StageDocument, finalDoc: StageDocument): string[] {
  const { lines } = splitLines(base)
  const blocks = scanBlocks(lines)
  const lost: string[] = []
  for (const path of removedKeys(baseDoc, finalDoc)) {
    let at = findLine(lines, blocks, path) - 2
    while (at >= 0 && (lines[at] ?? '').trimStart().startsWith('#')) {
      lost.push(lines[at] as string)
      at -= 1
    }
  }
  return lost
}

const blankRun = (lines: readonly string[]): number => {
  let longest = 0
  let run = 0
  for (const line of lines) {
    run = line.trim() === '' ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  return longest
}

/** The value as a text spells it: an unset key is no key, and an empty list a text does not spell out is no list. */
function asSpelled(value: StageValue): unknown {
  const copy = JSON.parse(JSON.stringify(value)) as {
    course?: { extension?: unknown[] }
    theme: { setPieces?: unknown[] }
  }
  if (copy.course?.extension?.length === 0) delete copy.course.extension
  if (copy.theme.setPieces?.length === 0) delete copy.theme.setPieces
  return copy
}

function withoutOnce(all: readonly string[], once: readonly string[]): string[] {
  const rest = [...all]
  for (const line of once) {
    const at = rest.indexOf(line)
    if (at >= 0) rest.splice(at, 1)
  }
  return rest
}

describe('printStage over random edit sequences', () => {
  it.each(SHIPPED_STAGE_IDS)('%s: the print of an empty sequence is the base', (id: ShippedStageId) => {
    const base = shippedStage(id)
    expect(printStage(base, documentOf(base))).toBe(base)
  })

  it.each(SHIPPED_STAGE_IDS)(
    `%s: ${SEQUENCES} sequences read back as the edited document with the comments of the tables that stay`,
    (id: ShippedStageId) => {
      const base = shippedStage(id)
      const baseDoc = documentOf(base)
      const baseLines = splitLines(base).lines
      for (let sequence = 0; sequence < SEQUENCES; sequence++) {
        const d = dice(sequence * 7919 + SHIPPED_STAGE_IDS.indexOf(id))
        trace.length = 0
        let doc = baseDoc
        const edits = 1 + d.below(8)
        for (let i = 0; i < edits; i++) doc = randomEdit(d, doc)
        const where = `${id}, sequence ${sequence} (${trace.join(', ')})`
        const text = printStage(base, doc)
        expect(parse(text), `${where}: reads back`).toEqual(asSpelled(doc.value))
        const lines = splitLines(text).lines
        const expected = withoutOnce(
          withoutOnce(commentLines(baseLines), lostComments(base, baseDoc, doc)),
          lostKeyComments(base, baseDoc, doc),
        )
        const actual = commentLines(lines)
        // Compared as text so that a failure shows the lines.
        expect(
          JSON.stringify({ extra: withoutOnce(actual, expected), missing: withoutOnce(expected, actual) }),
          `${where}: comments`,
        ).toBe('{"extra":[],"missing":[]}')
        // Removing a key that stood between two blank lines, with the comment above it, leaves both of them: the
        // library removes the lines of the key and not the gap. That is the one way a run of blank lines grows.
        expect(blankRun(lines), `${where}: blank lines`).toBeLessThanOrEqual(blankRun(baseLines) + 1)
      }
    },
  )
})
