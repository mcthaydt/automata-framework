// The corpus of seeded violations and Last Light's answers to it (`checks.golden.json`), for the tests of the checks.
// A case is a shipped blockout and a list of edits; `record-checks.mjs` applies the same edits and asks Last Light's
// own `validate`, and keeps the sha256 of the edited JSON so these tests can prove they built the same document.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Blockout } from '../format/blockout.schema'
import { loadFixture } from './fixtures'
import type { BlockoutName } from './geometry-golden'

export type EditPath = readonly (string | number)[]

/** `set` a value at a path, `push` onto the array there (making it when absent), or `delete` an element or a key. */
export interface CheckEdit {
  readonly op: 'set' | 'push' | 'delete'
  readonly path: EditPath
  readonly value?: unknown
}

export interface CheckCase {
  readonly id: string
  readonly base: BlockoutName
  readonly edits: readonly CheckEdit[]
  /** The puzzle's hotspot ids to check against; `null` is a level without a puzzle; absent is the base's own. */
  readonly puzzle?: readonly string[] | null
  /** The result the case is meant to fail, and a piece of the sentence it should say. A case without one fails nothing. */
  readonly fails?: string
  readonly problem?: string
  readonly note?: string
}

export interface GoldenResult {
  readonly id: string
  readonly ok: boolean
  readonly detail: string
}

export interface ChecksGolden {
  readonly blockouts: Record<
    BlockoutName,
    { readonly puzzle: readonly string[]; readonly results: readonly GoldenResult[] }
  >
  readonly cases: Record<
    string,
    {
      readonly sha256: string
      readonly puzzle: readonly string[] | null
      /** Absent when Last Light's `validate` threw instead of answering. */
      readonly results?: readonly GoldenResult[]
      readonly threw?: string
    }
  >
}

export const loadCheckCases = (): CheckCase[] =>
  JSON.parse(readFileSync(new URL('./fixtures/check-cases.json', import.meta.url), 'utf8')) as CheckCase[]

export const loadChecksGolden = (): ChecksGolden =>
  JSON.parse(readFileSync(new URL('./fixtures/checks.golden.json', import.meta.url), 'utf8')) as ChecksGolden

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

type Node = Record<string | number, unknown>

/** The document with the edits applied, in order, as `record-checks.mjs` applies them. The input is left alone. */
export function applyEdits(document: unknown, edits: readonly CheckEdit[]): unknown {
  const result = clone(document)
  for (const { op, path, value } of edits) {
    const parent = path
      .slice(0, -1)
      .reduce<unknown>((node, step) => (node as Node | undefined)?.[step], result) as Node | undefined
    const last = path.at(-1)
    if (parent === undefined || parent === null || last === undefined)
      throw new Error(`edit ${op}: no such path ${JSON.stringify(path)}`)
    if (op === 'set') parent[last] = clone(value)
    else if (op === 'push') {
      const list = parent[last] === undefined ? [] : (parent[last] as unknown[])
      parent[last] = list
      list.push(clone(value))
    } else if (op === 'delete') {
      if (Array.isArray(parent)) parent.splice(Number(last), 1)
      else delete parent[last]
    } else throw new Error(`unknown edit ${String(op)}`)
  }
  return result
}

/** The document a case asks about: its blockout with its edits applied. */
export const caseDocument = (spec: CheckCase): Blockout =>
  applyEdits(JSON.parse(loadFixture(spec.base)), spec.edits) as Blockout

export const caseDigest = (spec: CheckCase): string =>
  createHash('sha256')
    .update(JSON.stringify(caseDocument(spec)))
    .digest('hex')
