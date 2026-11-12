// @automata/sim: the deterministic simulation core. Deterministic math is the
// separate `./math` export. Game code never imports Koota directly.

export type { CommandRecord, EntityRef, SimContext, SpawnPart } from '../shared/define/context.ts'
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
} from '../shared/define/definitions.ts'
export type { FieldSchema, FieldType, FieldValue, FieldValues } from '../shared/define/fields.ts'
export { CanonicalJsonError, canonicalJson } from '../shared/hash/canonical.ts'
export { hex64, xxhash64 } from '../shared/hash/xxhash64.ts'
export { createRng, deriveSeed, type Rng, type RngState } from '../shared/rng/rng.ts'
export { sortedEntries, sortedKeys } from '../shared/util/sorted.ts'
export { SIM_VERSION } from '../shared/version.ts'
export type { FieldRecord, RenderDelta, RenderRow } from '../shared/world/entity-store.ts'
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
} from '../shared/world/sim.ts'
export {
  SNAPSHOT_VERSION,
  SnapshotFormatError,
  SnapshotMismatchError,
  type SnapshotView,
} from '../shared/world/snapshot.ts'
