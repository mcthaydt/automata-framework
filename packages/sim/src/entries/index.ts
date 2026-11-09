// @automata/sim: the deterministic simulation core. Deterministic math is the
// separate `./math` export. Game code never imports Koota directly.

export type { CommandRecord, EntityRef, SimContext, SpawnPart } from '../shared/define/context'
export {
  type CommandDef,
  type ComponentDef,
  type Def,
  defineCommand,
  defineComponent,
  defineEvent,
  definePlugin,
  defineResource,
  defineSystem,
  type EventDef,
  PHASES,
  type Phase,
  type PluginDef,
  type PluginState,
  type PluginStateSetup,
  type PreparedRestore,
  type ResourceDef,
  type SystemDef,
  type SystemSpec,
} from '../shared/define/definitions'
export type { FieldSchema, FieldType, FieldValue, FieldValues } from '../shared/define/fields'
export { CanonicalJsonError, canonicalJson } from '../shared/hash/canonical'
export { hex64, xxhash64 } from '../shared/hash/xxhash64'
export { createRng, deriveSeed, type Rng, type RngState } from '../shared/rng/rng'
export { sortedEntries, sortedKeys } from '../shared/util/sorted'
export { SIM_VERSION } from '../shared/version'
export type { FieldRecord, RenderDelta, RenderRow } from '../shared/world/entity-store'
export {
  type Command,
  createSim,
  type RejectedCommand,
  type RejectReason,
  type Sim,
  SimCapacityError,
  SimDisposedError,
  type SimEvent,
  SimFaultedError,
  type SimOptions,
  type StepResult,
} from '../shared/world/sim'
export {
  SNAPSHOT_VERSION,
  SnapshotFormatError,
  SnapshotMismatchError,
  type SnapshotView,
} from '../shared/world/snapshot'
