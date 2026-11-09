// What the debug overlay shows of the dialogue: a plain object built from the dialogue state. `debug` imports no
// extension, so the game hands this over under a `summaryPanel` id. It reads the state and never writes it.
import type { Value } from '@automata/puzzle/sim'
import { sortedKeys } from '@automata/sim'
import type { NarrativeDialogueValue } from './narrative.resource'

export interface NarrativeDebugSummary {
  readonly graph: string
  readonly place: string
  readonly stance: number
  readonly facts: Readonly<Record<string, Value>>
}

export function narrativeDebugSummary(dialogue: NarrativeDialogueValue): NarrativeDebugSummary {
  const facts: Record<string, Value> = {}
  for (const name of sortedKeys(dialogue.facts)) facts[name] = dialogue.facts[name] as Value
  return {
    graph: dialogue.graph ?? 'none',
    place: dialogue.place === null ? 'none' : `${dialogue.place.node}:${dialogue.place.line}`,
    stance: dialogue.stance,
    facts,
  }
}
