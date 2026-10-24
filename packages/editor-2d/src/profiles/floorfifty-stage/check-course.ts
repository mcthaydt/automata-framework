import type { Diagnostic } from '../profile'
import { problem, type ResolvedCheckContext } from './check-types'
import type { StageCourse } from './stage.schema'
import type { StageDocument } from './stage-document'
import { courseTopFloor } from './tunables'

// The course against the climb it describes (EDFF.1b decision 4), by FloorFifty's `validate/course.ts`: the four phrases
// account for floors 1 to the top of the course exactly once each, and the extension accounts for the floors above up to
// the tallest finite course. Floor zero is the fixed starting seat and belongs to no phrase.
//
// Floors are handled as inclusive runs, never one at a time: a phrase that says it ends at floor 1e15 is a finding, not
// a loop. A phrase or entry whose floors are not whole numbers (or that ends before it starts) makes no claim, because
// the shape check has already said what is wrong with it.

interface Span {
  readonly from: number
  readonly to: number
}

interface Claim extends Span {
  readonly owner: string
}

const FOUR_PHRASES = 'the four phrases'

function spanOf(stretch: { readonly fromFloor: number; readonly toFloor: number }): Span | undefined {
  const { fromFloor, toFloor } = stretch
  if (!Number.isInteger(fromFloor) || fromFloor < 1 || !Number.isInteger(toFloor) || toFloor < fromFloor)
    return undefined
  return { from: fromFloor, to: toFloor }
}

const floorCount = (spans: readonly Span[]): number =>
  spans.reduce((total, span) => total + span.to - span.from + 1, 0)

/** `floor 7`, `floors 5–10, 13`: how many floors there are decides the noun. */
function floorsText(spans: readonly Span[]): string {
  const count = floorCount(spans)
  const runs = spans.map((span) => (span.from === span.to ? String(span.from) : `${span.from}–${span.to}`))
  return `${count === 1 ? 'floor' : 'floors'} ${runs.join(', ')}`
}

const isOne = (spans: readonly Span[]): boolean => floorCount(spans) === 1

/** The parts of `span` the claims (disjoint, in floor order) cover, with whose they are, and the parts no claim covers. */
function divide(span: Span, claims: readonly Claim[]): { shared: Claim[]; free: Span[] } {
  const shared: Claim[] = []
  const free: Span[] = []
  let next = span.from
  for (const claim of claims) {
    if (claim.to < next || claim.from > span.to) continue
    if (claim.from > next) free.push({ from: next, to: claim.from - 1 })
    const covered = {
      from: Math.max(claim.from, span.from),
      to: Math.min(claim.to, span.to),
      owner: claim.owner,
    }
    const last = shared.at(-1)
    if (last?.owner === claim.owner && last.to + 1 === covered.from)
      shared[shared.length - 1] = { ...last, to: covered.to }
    else shared.push(covered)
    next = covered.to + 1
  }
  if (next <= span.to) free.push({ from: next, to: span.to })
  return { shared, free }
}

/** The runs of floors in [from, to] no claim covers. */
const gaps = (from: number, to: number, claims: readonly Claim[]): Span[] =>
  from > to ? [] : divide({ from, to }, claims).free

/** Adds spans to the claims of an owner, keeping them in floor order. */
const withClaims = (claims: readonly Claim[], spans: readonly Span[], owner: string): Claim[] =>
  [...claims, ...spans.map((span) => ({ ...span, owner }))].sort((a, b) => a.from - b.from)

/** Findings about the floors a stretch claims that others already have, one for each owner. */
function overlaps(
  code: string,
  path: string,
  who: string,
  shared: readonly Claim[],
  owners: (owner: string) => string,
): Diagnostic[] {
  const byOwner = new Map<string, Span[]>()
  for (const part of shared) byOwner.set(part.owner, [...(byOwner.get(part.owner) ?? []), part])
  return [...byOwner].map(([owner, spans]) =>
    problem(code, path, `${who} claims ${floorsText(spans)}, which ${owners(owner)} already has.`),
  )
}

const above = (spans: readonly Span[], floor: number): Span[] =>
  spans
    .filter((span) => span.to > floor)
    .map((span) => ({ from: Math.max(span.from, floor + 1), to: span.to }))

function checkPhrases(course: StageCourse, top: number): Diagnostic[] {
  const found: Diagnostic[] = []
  let claims: Claim[] = []
  course.phrases.forEach((phrase, index) => {
    const span = spanOf(phrase)
    if (span === undefined) return
    const path = `course.phrases[${index}]`
    const who = `The ${phrase.name} phrase`
    const { shared, free } = divide(span, claims)
    found.push(...overlaps('phraseOverlap', path, who, shared, (owner) => `the ${owner} phrase`))
    const past = above(free, top)
    if (past.length > 0)
      found.push(
        problem(
          'phrasePastTop',
          path,
          `${who} claims ${floorsText(past)}, past the top of the course (floor ${top}).`,
        ),
      )
    claims = withClaims(claims, free, phrase.name)
  })
  const missing = gaps(1, top, claims)
  if (missing.length > 0)
    found.push(
      problem(
        'floorsUnaccounted',
        'course.phrases',
        `No phrase accounts for ${floorsText(missing)}; every floor a player climbs needs a recorded purpose.`,
        'fit-phrases',
      ),
    )
  return found
}

function checkExtension(
  course: StageCourse,
  ids: readonly string[],
  top: number,
  tallest: number,
): Diagnostic[] {
  const found: Diagnostic[] = []
  let claims: Claim[] = []
  ;(course.extension ?? []).forEach((entry, index) => {
    const span = spanOf(entry)
    if (span === undefined) return
    const path = `course.extension[${ids[index] ?? index}]`
    const who = `The extension entry ${index + 1}`
    if (span.from <= top)
      found.push(
        problem(
          'extensionOverlap',
          path,
          `${who} claims ${floorsText([{ from: span.from, to: Math.min(span.to, top) }])}, which ${FOUR_PHRASES} already have.`,
        ),
      )
    if (span.to <= top) return
    const { shared, free } = divide({ from: Math.max(span.from, top + 1), to: span.to }, claims)
    found.push(...overlaps('extensionOverlap', path, who, shared, (owner) => owner))
    const past = above(free, tallest)
    if (past.length > 0)
      found.push(
        problem(
          'extensionPastTallest',
          path,
          `${who} claims ${floorsText(past)}, past the tallest course (floor ${tallest}).`,
        ),
      )
    claims = withClaims(
      claims,
      free
        .filter((part) => part.from <= tallest)
        .map((part) => ({ from: part.from, to: Math.min(part.to, tallest) })),
      `extension entry ${index + 1}`,
    )
  })
  const missing = gaps(top + 1, tallest, claims)
  if (missing.length > 0)
    found.push(
      problem(
        'extensionUnaccounted',
        'course.extension',
        `No extension entry accounts for ${floorsText(missing)}; a mode climbs ${isOne(missing) ? 'it, so it needs' : 'them, so they need'} a recorded purpose.`,
      ),
    )
  return found
}

/** Does nothing for a stage with no course, or one whose floor count is out of range (`tunableRange` reports that). */
export function checkCourse(document: StageDocument, context: ResolvedCheckContext): Diagnostic[] {
  const { course, courseTuning } = document.value
  if (course === undefined) return []
  const top = courseTopFloor(context.tunables, context.baseTuning, courseTuning)
  if (top === undefined) return []
  return [
    ...checkPhrases(course, top),
    ...checkExtension(course, document.ids.extension, top, context.tallestFloor),
  ]
}
