// Finding and checking references between content items.
// A reference must name
// an existing item (`unknownReference`), and that item must be the right kind (`wrongKind`). What changed is
// how references are found: they are marked in the schema (`contentRef`) and collected by walking the data.

import type { DataPath, Problem } from '../diagnostics/diagnostic'
import { isContentRefMarker, isLocalizedMarker } from './content-schema'

export interface FoundRef {
  readonly path: DataPath
  readonly kind: string
  readonly id: string
}

export interface FoundText {
  readonly path: DataPath
  readonly text: string
}

export interface ResolvedMarkers {
  /** The parsed value with every marker replaced by its plain string. */
  readonly value: unknown
  /** In key order (object keys sorted), so diagnostics and message keys come out in a stable order. */
  readonly refs: FoundRef[]
  readonly texts: FoundText[]
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype

export function resolveMarkers(value: unknown): ResolvedMarkers {
  const refs: FoundRef[] = []
  const texts: FoundText[] = []

  const walk = (node: unknown, path: (string | number)[]): unknown => {
    if (isContentRefMarker(node)) {
      refs.push({ path, kind: node.kind, id: node.id })
      return node.id
    }
    if (isLocalizedMarker(node)) {
      texts.push({ path, text: node.text })
      return node.text
    }
    if (Array.isArray(node)) return node.map((child, index) => walk(child, [...path, index]))
    if (isPlainObject(node)) {
      const out: Record<string, unknown> = {}
      // Sorted so the walk order, and everything derived from it, does not depend on authored key order.
      for (const key of Object.keys(node).sort()) out[key] = walk(node[key], [...path, key])
      return out
    }
    return node
  }

  return { value: walk(value, []), refs, texts }
}

/** Checks references against the IDs of every kind. `ids` maps a kind to its IDs. */
export function checkReferences(
  refs: readonly FoundRef[],
  ids: ReadonlyMap<string, ReadonlySet<string>>,
): Problem[] {
  const problems: Problem[] = []
  for (const ref of refs) {
    if (ids.get(ref.kind)?.has(ref.id)) continue
    // The more specific answer first: an ID that exists as another kind is a wrong pick, not a typo.
    const actualKind = [...ids.keys()].sort().find((kind) => ids.get(kind)?.has(ref.id))
    if (actualKind !== undefined) {
      problems.push({
        path: ref.path,
        code: 'wrongKind',
        message: `${ref.id} is a ${actualKind}, not a ${ref.kind}`,
      })
    } else {
      problems.push({
        path: ref.path,
        code: 'unknownReference',
        message: `no ${ref.kind} has the id ${ref.id}`,
      })
    }
  }
  return problems
}
