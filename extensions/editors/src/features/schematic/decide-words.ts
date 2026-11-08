// How a character decides, in the interpreter's own rules (`agent-step.ts`), said once under the list. The editor teaches
// the rules as they are: `extensions/systems/tests/unit/shared/sim/decide-rules.test.ts` pins each against the interpreter.
import { type AgentDef, isStill, routineMode, type Transition } from '@automata/systems/sim'
import { modeWords } from './pieces/piece.ts'

/** The rules, one line each, in the order a person needs them. */
export const DECIDE_LINES: readonly string[] = [
  'Some switches are checked all the time, some the moment it hears a noise, and some after it stops or gets stuck. The order counts only inside each group.',
  'Switches are checked from the top. Every one whose conditions hold does its actions.',
  'A switch from “Any mode it moves in” leaves out the modes where it stands still.',
  'It stops checking for that moment when a switch catches the player, starts a cutscene, or goes into or out of a mode where it stands still.',
  'The patrol only runs in the mode called Routine, or Patrol when it has no Routine.',
  '“Has stood still more than” counts the time it stands still. Switching mode does not reset it; “reset its wait” does.',
  'In a mode where it stands still, only the switches checked all the time run.',
]

const waits = (t: Transition): boolean =>
  t.when.some(
    (p) =>
      'timer' in p || ('fact' in p && (p.fact === 'self.idle' || p.fact === 'self.blocked') && p.is === true),
  )

const resetsWait = (t: Transition): boolean =>
  (t.do ?? []).some((e) => 'set' in e && e.set === 'self.timer' && e.to === 0)

/** What to tell a person about a mode, beyond its name and speed. */
export function modeNotes(agent: AgentDef, mode: string): string[] {
  const notes: string[] = []
  if (routineMode(agent) === mode) notes.push('Walks its patrol here')
  if (isStill(agent, mode)) notes.push('stands still')
  const waitsOut = agent.transitions.some((t) => t.from === mode && waits(t))
  const resetOnTheWayIn = agent.transitions.some((t) => t.to === mode && t.from !== mode && resetsWait(t))
  if (!isStill(agent, mode) && waitsOut && !resetOnTheWayIn && mode !== agent.initial)
    notes.push('This may switch at once: nothing resets its wait on the way in.')
  return notes
}

/** What to tell a person about a switch: it can never happen when the mode it leaves stands still and it waits. */
export function switchNote(agent: AgentDef, index: number): string | undefined {
  const t = agent.transitions[index]
  if (t === undefined || t.from === '*') return undefined
  return isStill(agent, t.from) && waits(t)
    ? `This never happens: it stands still in ${modeWords(t.from)}.`
    : undefined
}
