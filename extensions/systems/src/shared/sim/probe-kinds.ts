// What a probe list asks, for sorting rules and transitions by when they run (the original's `hearsIn` and `waitsIn`).
import type { AgentDef, Probe, SysEffect, SystemsDef } from './systems.schema'

/** The facts an agent knows about itself without asking the scene: whether it is waiting, and how. */
export const WAITING_FACTS: readonly string[] = ['self.idle', 'self.blocked']
/** Hooks every agent has: `stop` drops its path. */
export const BUILT_IN_HOOKS: readonly string[] = ['stop']
/** The routine (patrol) runs in the first of these modes the agent has. */
export const ROUTINE_MODES: readonly string[] = ['routine', 'patrol']
/** Places an effect may name besides a nav node, an agent or a point. */
export const PLACES: readonly string[] = ['player', 'self', 'noise', 'light', 'warmth']
/** The scenario policies the bots play. */
export const POLICIES: readonly string[] = ['scripted', 'cautious', 'random', 'greedy']

/** Whether a probe list asks about sound (such transitions and rules run when a noise is made, not in the tick). */
export const hearsIn = (when: readonly Probe[]): boolean =>
  when.some((p) => 'heard' in p || ('not' in p && hearsIn([p.not])))
/** Whether a transition asks how the agent is waiting (such transitions run after it moves, when it stood still). */
export const waitsIn = (when: readonly Probe[]): boolean =>
  when.some((p) => 'fact' in p && WAITING_FACTS.includes(p.fact) && p.is === true)

export const routineMode = (def: AgentDef): string | undefined =>
  ROUTINE_MODES.find((m) => def.modes.includes(m))
/** A mode with no speed: the agent does nothing in it but take the transitions out of it. */
export const isStill = (def: AgentDef, mode: string): boolean => !((def.speed[mode] ?? 0) > 0)

/** Whether a definition asks where the player crosses into another zone: a `crossed` probe, or a `followThrough`. */
export function usesPortals(def: SystemsDef): boolean {
  const probes = [
    ...def.rules.flatMap((r) => r.when),
    ...def.agents.flatMap((a) => a.transitions.flatMap((t) => t.when)),
  ]
  const effects: SysEffect[] = [
    ...def.rules.flatMap((r) => r.then),
    ...def.agents.flatMap((a) => [
      ...a.transitions.flatMap((t) => t.do ?? []),
      ...(a.routine ?? []).flatMap((r) => r.do ?? []),
    ]),
  ]
  const asks = (p: Probe): boolean => 'crossed' in p || ('not' in p && asks(p.not))
  return probes.some(asks) || effects.some((e) => 'followThrough' in e)
}
