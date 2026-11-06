// What a level holds, read the same way whatever its format (ED3D spec §4.7): the typed definitions and the things
// that stand in it. A profile hands this reader the raw definitions and instances with the path each came from; the
// answer is the definitions that parse, the things whose definition is among them, and a sentence with a path for
// everything that could not be read. Whether a value fits its field, how many a definition allows and whether a thing
// stands in a sector are checks (ED3D.2b), made over this answer; the reader only says what is there.
import { type FieldValue, type FieldValues, fieldValueSchema } from '@mcthaydt/automata-editor/kit/fields'
import { z } from 'zod'
import type { Point } from '../format/sector.schema'
import { type ThingDef, thingDefSchema } from './thing-def.schema'

/** An instance of a definition: its place, and the values of its fields. */
export interface Thing {
  readonly def: string
  readonly id: string
  readonly x: number
  readonly z: number
  readonly y?: number | undefined
  /** Every member beside the place, in the order the file has them. */
  readonly values: FieldValues
}

/** The entity a problem is about: enough to select it, and to frame it when it has a place. */
export interface EntityRef {
  readonly def: string
  readonly id: string
  readonly at?: Point | undefined
}

export interface EntityReadProblem {
  /** Where it is: in the file (`['entityDefs', 1, 'shape']`, `['entities', 3, 'x']`) or, for a fixed format, in its arrays. */
  readonly path: readonly (string | number)[]
  readonly message: string
  /** Set when the problem is about an instance that has a `def` and an `id` to name it by; a definition's problem has none. */
  readonly entity?: EntityRef | undefined
}

export interface EntityKit {
  readonly definitions: readonly ThingDef[]
  readonly things: readonly Thing[]
  /** The definitions' problems first, then the instances', each in file order. */
  readonly problems: readonly EntityReadProblem[]
}

/** A value as a file holds it, and where in the file it is. */
export interface RawEntry {
  readonly path: readonly (string | number)[]
  readonly value: unknown
}

const instanceSchema = z.looseObject({
  def: z.string(),
  id: z.string(),
  x: z.number(),
  z: z.number(),
  y: z.number().optional(),
})

/** Where a schema issue is, as steps of a path (a symbol cannot be a step of a JSON path). */
const stepsOf = (issue: { readonly path: readonly PropertyKey[] }): (string | number)[] =>
  issue.path.filter((step): step is string | number => typeof step !== 'symbol')

/** How an instance is named in a sentence: its id, or its place in the list when it has none. */
const labelOf = (entry: RawEntry): string => {
  const { value, path } = entry
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : undefined
  return typeof id === 'string' ? id : `#${path.at(-1)}`
}

/** The entity a raw instance names itself as, when it has a string `def` and `id`; `at` when its place is two numbers. */
function entityOf(value: unknown): EntityRef | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { def, id, x, z } = value as Record<string, unknown>
  if (typeof def !== 'string' || typeof id !== 'string') return undefined
  return typeof x === 'number' && typeof z === 'number' ? { def, id, at: { x, z } } : { def, id }
}

const problemOf = (
  path: readonly (string | number)[],
  message: string,
  entity: EntityRef | undefined,
): EntityReadProblem => (entity === undefined ? { path, message } : { path, message, entity })

function readThing(
  entry: RawEntry,
  definitions: ReadonlyMap<string, ThingDef>,
): { readonly thing: Thing | undefined; readonly problems: EntityReadProblem[] } {
  const { value, path } = entry
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {
      thing: undefined,
      problems: [{ path, message: 'an entity is an object with def, id, x and z' }],
    }
  const label = labelOf(entry)
  const about = entityOf(value)
  const parsed = instanceSchema.safeParse(value)
  if (!parsed.success)
    return {
      thing: undefined,
      problems: parsed.error.issues.map((issue) =>
        problemOf(
          [...path, ...stepsOf(issue)],
          `entity ${label}: ${issue.path.join('.')}: ${issue.message}`,
          about,
        ),
      ),
    }
  const { def, id, x, z: south, y, ...rest } = parsed.data
  if (!definitions.has(def))
    return {
      thing: undefined,
      problems: [
        problemOf([...path, 'def'], `entity ${id} is of definition ${def}, which is not defined`, about),
      ],
    }
  const held: [string, FieldValue][] = []
  const problems: EntityReadProblem[] = []
  for (const [key, member] of Object.entries(rest)) {
    const parsedValue = fieldValueSchema.safeParse(member)
    if (parsedValue.success) held.push([key, parsedValue.data])
    else
      problems.push(problemOf([...path, key], `entity ${id}: ${key} is not a value a field can hold`, about))
  }
  if (problems.length > 0) return { thing: undefined, problems }
  // `fromEntries` defines each member as data and never as the prototype, whatever a file calls it.
  const values: FieldValues = Object.fromEntries(held)
  return { thing: { def, id, x, z: south, ...(y === undefined ? {} : { y }), values }, problems }
}

export function readEntityKit(input: {
  readonly definitions: readonly RawEntry[]
  readonly instances: readonly RawEntry[]
}): EntityKit {
  const byId = new Map<string, ThingDef>()
  const problems: EntityReadProblem[] = []
  for (const { value, path } of input.definitions) {
    const parsed = thingDefSchema.safeParse(value)
    if (!parsed.success) {
      // A rule says what it means by itself; a member the schema refused is named, and so is the definition either way.
      const label = labelOf({ path, value })
      for (const issue of parsed.error.issues) {
        const where = issue.code === 'custom' || issue.path.length === 0 ? '' : `${issue.path.join('.')}: `
        problems.push({
          path: [...path, ...stepsOf(issue)],
          message: `entity definition ${label}: ${where}${issue.message}`,
        })
      }
      continue
    }
    // A second definition with the same id is the `ids` check's to report; the first is the one things are read by.
    if (!byId.has(parsed.data.id)) byId.set(parsed.data.id, parsed.data)
  }
  const things: Thing[] = []
  for (const entry of input.instances) {
    const read = readThing(entry, byId)
    if (read.thing !== undefined) things.push(read.thing)
    problems.push(...read.problems)
  }
  return { definitions: [...byId.values()], things, problems }
}
