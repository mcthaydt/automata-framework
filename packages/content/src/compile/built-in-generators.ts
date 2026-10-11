// The derived files every build writes (M1.3 spec §3.7). They are generators on the same hook a game uses,
// so a game's generator sees exactly what they see, and a game generator that writes one of these paths is
// refused as a clash. `content.json`, `content.hash`, `sim-content.json` and `sim-content.hash` come from the
// `artifact` generator, which runs first.

import type { FlowGraph } from '../flow/check-flow'
import { flowMermaid } from '../flow/flow-mermaid'
import { type GameSource, rukenFields } from '../game/game-facts'
import { type ContentGenerator, defineContentGenerator } from '../generate/content-generator'
import { renderTypes } from '../generate/render-types'
import { canonicalFile } from '../hash/canonical-file'
import { renderMessages } from '../locale/messages'

/** Facts the compiler worked out that are not in the hashed data itself. */
export interface BuiltInFacts {
  readonly flow: FlowGraph | undefined
  readonly game: GameSource | undefined
  /** The source language, then each translation present (derived, never typed). */
  readonly languages: readonly string[]
  readonly hasAssets: boolean
}

const sortedUnique = (values: Iterable<string>): string[] => [...new Set(values)].sort()

export function builtInGenerators(facts: BuiltInFacts): ContentGenerator[] {
  const sourceLanguage = facts.languages[0] ?? 'en'
  return [
    defineContentGenerator('artifact', ({ data, hash, sim }) => ({
      files: {
        'content.json': canonicalFile(data),
        'content.hash': `${hash}\n`,
        // The partition the sim receives and the hash that gates snapshots (M2.2), written from what the
        // compiler made rather than re-derived here.
        'sim-content.json': canonicalFile(sim.data),
        'sim-content.hash': `${sim.hash}\n`,
      },
    })),
    defineContentGenerator('types', ({ data, schemas }) => {
      const ids = new Map<string, string[]>()
      for (const def of schemas) {
        if ('folder' in def.place) ids.set(def.kind, Object.keys((data[def.kind] ?? {}) as object).sort())
      }
      const flow =
        facts.flow === undefined
          ? undefined
          : { screens: facts.flow.screens, events: sortedUnique(facts.flow.transitions.map((t) => t.event)) }
      const tuningNames = Object.keys((data.tuning ?? {}) as object).sort()
      const text = renderTypes({
        schemas,
        ids,
        flow,
        tuningNames,
        hasGame: facts.game !== undefined,
        hasAssets: facts.hasAssets,
      })
      return { files: { 'content.d.ts': text } }
    }),
    defineContentGenerator('messages', ({ messages }) => ({
      files: { [`messages/${sourceLanguage}.json`]: renderMessages(messages) },
    })),
    defineContentGenerator('tuning-meta', ({ tuning }) => ({
      files: { 'tuning-meta.json': canonicalFile(tuning) },
    })),
    defineContentGenerator('flow', () =>
      facts.flow === undefined ? {} : { files: { 'flow.mmd': flowMermaid(facts.flow) } },
    ),
    defineContentGenerator('ruken-fields', () =>
      facts.game === undefined
        ? {}
        : { files: { 'ruken-fields.json': canonicalFile(rukenFields(facts.game, facts.languages)) } },
    ),
  ]
}
