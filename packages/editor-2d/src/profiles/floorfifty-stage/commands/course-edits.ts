import type { IdSource } from '../../../model/ids'
import type { Rng } from '../course-rng'
import {
  PHRASE_NAMES,
  type PhraseName,
  type StageCourse,
  type StageExtension,
  type StagePhrase,
} from '../stage.schema'
import type { StageDocument } from '../stage-document'
import { checkIndex, freshId, removeAt, withKey, withValue } from './edit-helpers'

// The Course view's edits (2D editor spec §10.6, EDFF.1d): the seed, the four phrases that explain it and the extension
// entries above them. A stage may have no course; every command but `addCourse` then throws `RangeError`.

/** Seeds a reroll draws from: five digits, the magnitude of the shipped ones. */
const SEED_LIMIT = 99_999

/** What a new phrase says until its author replaces it; the schema wants some text. */
const PLACEHOLDER_PURPOSE: Readonly<Record<PhraseName, string>> = {
  teach: 'What the player learns first.',
  combine: 'What the player has to put together.',
  recover: 'Where the player catches their breath.',
  finish: 'How the climb ends.',
}

function courseOf(document: StageDocument): StageCourse {
  const { course } = document.value
  if (course === undefined) throw new RangeError('the stage has no course')
  return course
}

/** The document with this course; its extension ids too when given, else the ones it has. */
function withCourse(
  document: StageDocument,
  course: StageCourse | undefined,
  extensionIds?: readonly string[],
): StageDocument {
  const edited = withValue(document, withKey(document.value, 'course', course))
  return extensionIds === undefined ? edited : { ...edited, ids: { ...edited.ids, extension: extensionIds } }
}

/**
 * The phrases tiling floors 1 to `top`, each ending the floor before the next one starts. A phrase keeps the start it
 * has where there is room for it: after the phrase before and early enough to leave a floor for each phrase after. The
 * first starts at 1, and a start that is not a whole number counts as missing.
 */
function fitPhrases(phrases: readonly StagePhrase[], top: number): StagePhrase[] {
  const starts: number[] = []
  phrases.forEach((phrase, index) => {
    const after = starts[index - 1] ?? 0
    const wanted = index === 0 ? 1 : phrase.fromFloor
    const latest = top - (phrases.length - 1 - index)
    starts.push(Math.min(latest, Math.max(after + 1, Number.isInteger(wanted) ? wanted : 0)))
  })
  return phrases.map((phrase, index) => {
    const fromFloor = starts[index] as number
    const toFloor = index === phrases.length - 1 ? top : (starts[index + 1] as number) - 1
    return phrase.fromFloor === fromFloor && phrase.toFloor === toFloor
      ? phrase
      : { ...phrase, fromFloor, toFloor }
  })
}

/** What the floors above the four-phrase arc say until their author replaces it. */
const PLACEHOLDER_EXTENSION = 'The climb above the four-phrase arc.'

/**
 * Gives a stage that has none a course that the checks accept: four phrases, as even as whole floors allow, from
 * floor 1 to `top`, and one extension entry for the floors from there to `tallest` (the tallest finite climb), which
 * the game's compiler wants a purpose for. The caller reads both floors from the stage's tuning and the context.
 */
export function addCourse(
  document: StageDocument,
  source: IdSource,
  options: { readonly seed: number; readonly top: number; readonly tallest: number },
): StageDocument {
  const { seed, top, tallest } = options
  if (document.value.course !== undefined) throw new RangeError('the stage already has a course')
  if (!Number.isInteger(top) || top < PHRASE_NAMES.length)
    throw new RangeError(
      `a course of ${PHRASE_NAMES.length} phrases needs a top floor of ${PHRASE_NAMES.length} or more, not ${top}`,
    )
  const phrases = PHRASE_NAMES.map((name, index) => ({
    name,
    fromFloor: 1 + Math.floor((index * top) / PHRASE_NAMES.length),
    toFloor: top,
    purpose: PLACEHOLDER_PURPOSE[name],
  }))
  const course = { seed, phrases: fitPhrases(phrases, top) }
  if (!(tallest > top)) return withCourse(document, course)
  const id = freshId(source, document.ids.extension)
  const extension = [{ fromFloor: top + 1, toFloor: tallest, purpose: PLACEHOLDER_EXTENSION }]
  return withCourse(document, { ...course, extension }, [...document.ids.extension, id])
}

/** Drops the course with its extension; the stage then plays no frozen climb. */
export function removeCourse(document: StageDocument): StageDocument {
  return document.value.course === undefined ? document : withCourse(document, undefined, [])
}

export function setSeed(document: StageDocument, seed: number): StageDocument {
  const course = courseOf(document)
  return withCourse(document, withKey(course, 'seed', seed))
}

/** A new seed from the rng, never the one the course has. */
export function rerollSeed(document: StageDocument, rng: Pick<Rng, 'nextInt'>): StageDocument {
  const { seed } = courseOf(document)
  const drawn = rng.nextInt(0, SEED_LIMIT)
  return setSeed(document, drawn === seed ? (drawn + 1) % (SEED_LIMIT + 1) : drawn)
}

export function setPhrase<K extends 'fromFloor' | 'toFloor' | 'purpose'>(
  document: StageDocument,
  name: PhraseName,
  field: K,
  value: StagePhrase[K],
): StageDocument {
  const course = courseOf(document)
  const phrase = course.phrases.find((candidate) => candidate.name === name)
  if (phrase === undefined) throw new RangeError(`the course has no ${name} phrase`)
  const next = withKey(phrase, field, value)
  if (next === phrase) return document
  return withCourse(document, {
    ...course,
    phrases: course.phrases.map((candidate) => (candidate === phrase ? next : candidate)),
  })
}

/**
 * Makes the four phrases tile floors 1 to `top`: the repair for `floorsUnaccounted` (and for a phrase past the top, or
 * two that overlap). It changes the floors that are wrong and keeps the boundaries the author drew; see `fitPhrases`.
 * The caller knows the top floor from the stage's tuning, so this command knows nothing of tuning.
 */
export function fitPhrasesToCourse(document: StageDocument, top: number): StageDocument {
  const course = courseOf(document)
  if (!Number.isInteger(top) || top < course.phrases.length)
    throw new RangeError(`${course.phrases.length} phrases cannot tile floors 1 to ${top}`)
  const phrases = fitPhrases(course.phrases, top)
  return phrases.every((phrase, index) => phrase === course.phrases[index])
    ? document
    : withCourse(document, { ...course, phrases })
}

/** Adds a stretch above the four-phrase arc, after the others. */
export function addExtension(
  document: StageDocument,
  source: IdSource,
  entry: StageExtension,
): StageDocument {
  const course = courseOf(document)
  const entries = course.extension ?? []
  const id = freshId(source, document.ids.extension)
  return withCourse(document, { ...course, extension: [...entries, entry] }, [...document.ids.extension, id])
}

export function setExtension<K extends keyof StageExtension>(
  document: StageDocument,
  index: number,
  field: K,
  value: StageExtension[K],
): StageDocument {
  const course = courseOf(document)
  const entries = course.extension ?? []
  checkIndex('extension entry', index, entries.length)
  const entry = entries[index] as StageExtension
  const next = withKey(entry, field, value)
  if (next === entry) return document
  return withCourse(document, {
    ...course,
    extension: entries.map((candidate, position) => (position === index ? next : candidate)),
  })
}

/** Removes an entry; the list is unset, not empty, when the last one goes. */
export function removeExtension(document: StageDocument, index: number): StageDocument {
  const course = courseOf(document)
  const entries = course.extension ?? []
  checkIndex('extension entry', index, entries.length)
  const remaining = removeAt(entries, index)
  return withCourse(
    document,
    withKey(course, 'extension', remaining.length === 0 ? undefined : remaining),
    removeAt(document.ids.extension, index),
  )
}
