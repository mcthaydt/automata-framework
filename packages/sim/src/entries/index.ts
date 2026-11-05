// @mcthaydt/automata-sim: the deterministic simulation core (A0+A1 spec §4). Deterministic math is the
// separate `./math` export. Game code never imports Koota directly.

export type { CommandRecord, EntityRef, SimContext, SpawnPart } from '../features/define/context'
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
} from '../features/define/definitions'
export type { FieldSchema, FieldType, FieldValue, FieldValues } from '../features/define/fields'
export { CanonicalJsonError, canonicalJson } from '../features/hash/canonical'
export { hex64, xxhash64 } from '../features/hash/xxhash64'
export { createRng, deriveSeed, type Rng, type RngState } from '../features/rng/rng'
export type { FieldRecord, RenderDelta, RenderRow } from '../features/world/entity-store'
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
} from '../features/world/sim'
export {
  SNAPSHOT_VERSION,
  SnapshotFormatError,
  SnapshotMismatchError,
  type SnapshotView,
} from '../features/world/snapshot'
export { sortedEntries, sortedKeys } from '../shared/util/sorted'
export { SIM_VERSION } from '../shared/version'
