// Helpers the codec tests share: what changed between two texts of one file.

import { scan } from '@automataframework/automata-editor/kit/documents'
import { expect } from 'vitest'

/** The longest common prefix and suffix of two texts leave this much in each: the one region that changed. */
export function changedRegion(before: string, after: string): { removed: string; added: string } {
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  return {
    removed: before.slice(prefix, before.length - suffix),
    added: after.slice(prefix, after.length - suffix),
  }
}

/** Where two texts of the same shape differ: only in scalar literals (every byte between them is equal), and which. */
export function literalEdits(before: string, after: string): string[] {
  const a = scan(before)
  const b = scan(after)
  const skeleton = (text: string, literals: typeof a.literals) => {
    let out = ''
    let at = 0
    for (const literal of literals) {
      out += `${text.slice(at, literal.span.start)}\u0000`
      at = literal.span.end
    }
    return out + text.slice(at)
  }
  expect(b.literals.map((literal) => literal.path)).toEqual(a.literals.map((literal) => literal.path))
  expect(skeleton(after, b.literals), 'every byte outside a literal is unchanged').toBe(
    skeleton(before, a.literals),
  )
  return a.literals.flatMap((literal, i) =>
    b.literals[i]?.text === literal.text ? [] : [JSON.stringify(literal.path)],
  )
}
