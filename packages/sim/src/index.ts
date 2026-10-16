// @mcthaydt/automata-sim: the deterministic simulation core (A0+A1 spec §4). Deterministic math is the
// separate `./math` export. Game code never imports Koota directly.

export type { CommandRecord, EntityRef, SimContext, SpawnPart } from './define/context'
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
} from './define/definitions'
export type { FieldSchema, FieldType, FieldValue, FieldValues } from './define/fields'
export { CanonicalJsonError, canonicalJson } from './hash/canonical'
export { hex64, xxhash64 } from './hash/xxhash64'
export { createRng, deriveSeed, type Rng, type RngState } from './rng/rng'
export { sortedEntries, sortedKeys } from './util/sorted'
export { SIM_VERSION } from './version'
export type { FieldRecord, RenderDelta, RenderRow } from './world/entity-store'
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
} from './world/sim'
export {
  SNAPSHOT_VERSION,
  SnapshotFormatError,
  SnapshotMismatchError,
  type SnapshotView,
} from './world/snapshot'
