// A seeded run over the shipped depot: random edits of the four kinds the editor makes, each patched through the
// codec, each checked for reading back as the edited model and for touching only what it edited, then reverted.
// The generator is a fixed linear congruential sequence, so a failure replays.

import { type JsonPath, scan } from '@automata/editor/kit/documents'
import { describe, expect, it } from 'vitest'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'
import type { FileCodec } from '#src/shared/level-session/file-codec.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { changedRegion, literalEdits } from '#src/testing/text-diff.ts'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const EDITS_PER_FIXTURE = 60

function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const at = (root: Json, path: JsonPath): Json =>
  path.reduce<Json>((node, key) => (node as Record<string | number, Json>)[key] as Json, root)

interface Subject {
  readonly name: string
  readonly codec: FileCodec<unknown>
  readonly text: string
}

// The AF depot. Its seed is the one it had when it came after five other files, so a failure replays as it did.
const SUBJECTS: readonly Subject[] = [
  {
    name: 'depot.af-sector',
    codec: afSectorCodec as FileCodec<unknown>,
    text: loadAuthored('depot.af-sector'),
  },
]
const SEED = 20261028

describe('seeded edit round trips on the shipped depot', () => {
  SUBJECTS.forEach(({ name, codec, text }) => {
    it(`${name}: ${EDITS_PER_FIXTURE} random edits read back, touch only their own bytes, and revert`, () => {
      const parsed = codec.parse(text)
      if (!parsed.ok) throw new Error('fixture does not parse')
      const original = parsed.value as unknown as Json
      const scanned = scan(text)
      const numbers = scanned.literals.filter((literal) => literal.kind === 'number')
      // A string that is an `id` stays out of the string edits: renaming one is a remove and an insert, tested elsewhere.
      const strings = scanned.literals.filter((literal) => literal.kind === 'string')
      const renamable = strings.filter((literal) => literal.path[literal.path.length - 1] !== 'id')
      const arrays: JsonPath[] = []
      const collect = (node: ReturnType<typeof scan>['root']) => {
        if (node.kind === 'array' && node.children.length > 0) arrays.push(node.path)
        for (const child of node.children) collect(child)
      }
      collect(scanned.root)

      const random = lcg(SEED)
      const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
      const counts = { nudge: 0, string: 0, remove: 0, add: 0 }

      for (let n = 0; n < EDITS_PER_FIXTURE; n++) {
        const edited = structuredClone(original)
        const expectedBack = structuredClone(original)
        const kind = (['nudge', 'string', 'remove', 'add'] as const)[n % 4] as keyof typeof counts
        let exactRevert: boolean
        if (kind === 'nudge') {
          const literal = pick(numbers)
          const step = pick([0.25, -0.25, 1, -1])
          const value = Math.round(((literal.value as number) + step) * 1e4) / 1e4
          const parent = at(edited, literal.path.slice(0, -1)) as Record<string | number, Json>
          parent[literal.path[literal.path.length - 1] as string | number] = value
          // A revert is byte-exact only for a literal the file wrote the way we do: `1.0` comes back as `1`, and a
          // number with more than 4 decimals (Last Light's `spawn.facing` is pi) comes back rounded to 4.
          const rounded = Math.round((literal.value as number) * 1e4) / 1e4
          exactRevert = String(literal.value) === literal.text && rounded === literal.value
          if (rounded !== literal.value) {
            const back = at(expectedBack, literal.path.slice(0, -1)) as Record<string | number, Json>
            back[literal.path[literal.path.length - 1] as string | number] = rounded
          }
        } else if (kind === 'string') {
          const literal = pick(renamable)
          const other = pick(strings.filter((candidate) => candidate.value !== literal.value))
          const parent = at(edited, literal.path.slice(0, -1)) as Record<string | number, Json>
          parent[literal.path[literal.path.length - 1] as string | number] = other.value as string
          exactRevert = JSON.stringify(literal.value) === literal.text
        } else {
          const path = pick(arrays)
          const list = at(edited, path) as Json[]
          const index = Math.floor(random() * list.length)
          if (kind === 'remove') list.splice(index, 1)
          else {
            const copy = structuredClone(list[index] as Json)
            if (
              copy !== null &&
              typeof copy === 'object' &&
              !Array.isArray(copy) &&
              typeof copy.id === 'string'
            ) {
              copy.id = `${copy.id}Copy${n}`
            }
            list.splice(index, 0, copy)
          }
          exactRevert = kind === 'add'
        }
        counts[kind]++

        const patched = codec.patch(text, original, edited)
        if (!patched.ok)
          throw new Error(`edit ${n} (${kind}) refused at ${JSON.stringify(patched.path)}: ${patched.detail}`)
        expect(JSON.parse(patched.text), `edit ${n} (${kind}) reads back as the edited model`).toStrictEqual(
          edited,
        )

        if (kind === 'nudge' || kind === 'string') {
          expect(literalEdits(text, patched.text), `edit ${n} (${kind}) changes one literal`).toHaveLength(1)
        } else if (kind === 'add') {
          expect(changedRegion(text, patched.text).removed, `edit ${n}: an add only inserts`).toBe('')
        } else {
          expect(changedRegion(text, patched.text).added, `edit ${n}: a removal only deletes`).toBe('')
        }

        const reverted = codec.patch(patched.text, edited, original)
        if (!reverted.ok) throw new Error(`revert ${n} (${kind}) refused at ${JSON.stringify(reverted.path)}`)
        expect(JSON.parse(reverted.text), `revert ${n} (${kind}) reads back as the original`).toStrictEqual(
          expectedBack,
        )
        // A removal brought back is written in the layout of its neighbours, which a hand-formatted file need not
        // share with the element it lost; for the other kinds the original bytes come back.
        if (exactRevert) expect(reverted.text, `revert ${n} (${kind}) restores the bytes`).toBe(text)
      }
      expect(counts.nudge + counts.string + counts.remove + counts.add).toBe(EDITS_PER_FIXTURE)
    })
  })
})
