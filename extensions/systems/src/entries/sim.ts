// @automataframework/systems/sim: world rules and agents as data, a sim entry.

export { carriedLightContent, carriedLightFileSchema } from '../shared/carried-light.content'
export { peekContent, peekFileSchema } from '../shared/peek.content'
export { ARRIVE } from '../shared/sim/agent-step'
export {
  type CarriedLightDef,
  type CarriedLightFile,
  carriedLightDefOf,
  carriedLightProblems,
  DEFAULT_CARRIED_LIGHT,
  fuelTicksOf,
  refill,
  refuel,
} from '../shared/sim/carried-light'
export { ToggleLight } from '../shared/sim/carried-light.command'
export { CarriedLight } from '../shared/sim/carried-light.component'
export { LightDry } from '../shared/sim/carried-light.event'
export { type CarriedLightOptions, createCarriedLight } from '../shared/sim/carried-light.plugin'
export type { Outcome } from '../shared/sim/effect'
export { followPlayer } from '../shared/sim/follow'
export {
  DEFAULT_PEEK,
  type Doorway,
  type PeekDef,
  type PeekFile,
  type PeekState,
  peekDefOf,
} from '../shared/sim/peek'
export { type PeekPayload, SystemsPeek } from '../shared/sim/peek.event'
export { createPeek, peekOf } from '../shared/sim/peek.plugin'
export { SystemsPeekState } from '../shared/sim/peek.resource'
export type { PeekOptions } from '../shared/sim/peek.system'
export { AT_NODE, type Subject } from '../shared/sim/probe'
export {
  BUILT_IN_HOOKS,
  hearsIn,
  isStill,
  routineMode,
  usesPortals,
  waitsIn,
} from '../shared/sim/probe-kinds'
export { FOLLOW_CLEAR, THROUGH, UNHEARD } from '../shared/sim/pursuit'
export { reachable, reserveNodes } from '../shared/sim/reserve'
export { Hide, type HidePayload, Unhide } from '../shared/sim/systems.command'
export { SystemsAgent } from '../shared/sim/systems.component'
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
} from '../shared/sim/systems.event'
export { createSystems, type Systems, systems } from '../shared/sim/systems.plugin'
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
} from '../shared/sim/systems.resource'
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
} from '../shared/sim/systems.schema'
export { effectSchema, probeSchema, systemsDefShape } from '../shared/sim/systems.schema'
export { NOISE_LIFE } from '../shared/sim/systems.system'
export {
  checkSystems,
  type SystemsCheckOptions,
  type SystemsWarning,
  type SystemsWarningOptions,
  systemsWarnings,
} from '../shared/sim/systems-checks'
export { createWatch } from '../shared/sim/watch.plugin'
export { SystemsWatch } from '../shared/sim/watch.resource'
export type { SystemsOptions, SystemsWorld } from '../shared/sim/world'
