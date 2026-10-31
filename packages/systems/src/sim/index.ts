// @mcthaydt/automata-systems/sim: world rules and agents as data (M6 spec §4.6), a sim entry.
export { ARRIVE } from './agent-step'
export type { Outcome } from './effect'
export { AT_NODE, type Subject } from './probe'
export { BUILT_IN_HOOKS, hearsIn, isStill, routineMode, usesPortals, waitsIn } from './probe-kinds'
export { FOLLOW_CLEAR, THROUGH, UNHEARD } from './pursuit'
export { reachable, reserveNodes } from './reserve'
export { Hide, type HidePayload, Unhide } from './systems.command'
export { SystemsAgent } from './systems.component'
export {
  type CaughtPayload,
  type CutscenePayload,
  type LinePayload,
  type ModePayload,
  SystemsCaught,
  SystemsCutscene,
  SystemsLine,
  SystemsMode,
  SystemsNoise,
  type SystemsNoisePayload,
} from './systems.event'
export { createSystems, type Systems, systems } from './systems.plugin'
export {
  type AgentRecord,
  type Crossing,
  type Noise,
  type Pending,
  type PursuitValue,
  SystemsEnv,
  type SystemsEnvValue,
  SystemsNoises,
  SystemsPursuit,
  SystemsScene,
  SystemsState,
  type SystemsStateValue,
  type Watcher,
} from './systems.resource'
export type {
  AgentDef,
  Fairness,
  MatrixCell,
  Probe,
  RoutineStop,
  Rule,
  Scenario,
  Sense,
  SysEffect,
  SystemsDef,
  Transition,
  Tunable,
} from './systems.schema'
export { effectSchema, probeSchema, systemsDefShape } from './systems.schema'
export { NOISE_LIFE } from './systems.system'
export { checkSystems, type SystemsCheckOptions } from './systems-checks'
export type { SystemsOptions, SystemsWorld } from './world'
