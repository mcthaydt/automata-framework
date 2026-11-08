// A character's patrol: its stops in order, how long it waits at each, and what it does there. Where it starts follows
// from them: a character begins at its first stop unless the level places it.
import type { AgentDef, RoutineStop, SysEffect } from '@automata/systems/sim'
import type { Field } from '../../shared/fields.ts'
import { choices } from './pieces/conditions.ts'
import { spaced } from './pieces/piece.ts'

/** Where the character starts, in words (spec 9, H3). */
export function startWords(character: AgentDef): string {
  const first = character.routine?.[0]
  return first === undefined
    ? "the level's corner. Give it a patrol stop to start at."
    : `its first patrol stop, ${spaced(first.node)}`
}

/** The fields of one stop: which place, and how long it waits there. */
export function stopFields(stop: RoutineStop, places: readonly string[]): Field[] {
  return [
    {
      key: 'node',
      label: 'Place',
      kind: 'choice',
      value: stop.node,
      options: choices(places, stop.node, spaced),
    },
    {
      key: 'dwell',
      label: 'Waits',
      kind: 'number',
      unit: 's',
      min: 0,
      max: 600,
      step: 0.5,
      value: stop.dwell,
    },
  ]
}

export function stopWords(stop: RoutineStop): string {
  return `${spaced(stop.node)}: waits ${String(stop.dwell)} s`
}

export function writeStop(stop: RoutineStop, key: string, next: unknown): RoutineStop {
  if (key === 'node') return { ...stop, node: String(next) }
  if (key === 'dwell') return { ...stop, dwell: Number(next) }
  return stop
}

export function withStopAction(stop: RoutineStop, effect: SysEffect): RoutineStop {
  return { ...stop, do: [...(stop.do ?? []), effect] }
}

export function withoutStopAction(stop: RoutineStop, at: number): RoutineStop {
  const rest = (stop.do ?? []).filter((_, i) => i !== at)
  const { do: _gone, ...others } = stop
  return rest.length === 0 ? others : { ...others, do: rest }
}

/** A new stop at the first place the stop list does not already end on (or the first place). */
export function freshStop(
  places: readonly string[],
  routine: readonly RoutineStop[] | undefined,
): RoutineStop {
  const last = routine?.[routine.length - 1]?.node
  const node = places.find((p) => p !== last) ?? places[0] ?? ''
  return { node, dwell: 2 }
}
