// What a new behaviour file starts as. A scene's file needs every table (the schema's shape), so a new one carries the
// design tables empty and the fairness of a careful player (`systems/testing/toy.ts`): wins 9 times in 10, the first
// threat after 20 s, 1.5 s of warning, at most 1 death a run, a 1.3 safe-window margin.
import type { AgentDef, SystemsDef } from '@automata/systems/sim'
import { stringify } from 'smol-toml'

/** A new character: one mode, patrol, at a walking pace, and nothing else; a ready-made behaviour fills the rest. */
export function newAgent(id: string): AgentDef {
  return { id, modes: ['patrol'], initial: 'patrol', speed: { patrol: 1.2 }, senses: [], transitions: [] }
}

export function newSystemsFile(scene: string, agent: AgentDef): SystemsDef {
  return {
    scene,
    objects: [],
    matrix: [],
    tunables: {},
    rules: [],
    agents: [agent],
    scenarios: [],
    fairness: {
      cautiousWin: 0.9,
      firstThreatAfter: 20,
      telegraph: 1.5,
      maxDeathsPerRun: 1,
      safeWindowMargin: 1.3,
    },
  }
}

/** The file's text for a scene's definition. */
export function systemsFileText(def: SystemsDef): string {
  return `# How this scene's characters behave.\n${stringify(def as unknown as Record<string, unknown>)}`
}
