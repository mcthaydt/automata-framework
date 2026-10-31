// The host contract (DIST spec §4): every name a game, a package or a target's adapter uses to talk about the host.
export { type AudioChange, AudioChangeSchema } from './audio.schema'
export { CAPABILITIES, type Capability, CapabilitySchema } from './capability.schema'
export {
  type DisplayMetricsPayload,
  DisplayMetricsPayloadSchema,
  type FullscreenRes,
  FullscreenResSchema,
} from './display.schema'
export {
  type EntitlementsPayload,
  EntitlementsPayloadSchema,
  type SubscriptionEntitlement,
} from './entitlements.schema'
export { ERROR_CODES, type ErrorCode, ErrorCodeSchema } from './error-code.schema'
export { type InputMode, type InputModePayload, InputModePayloadSchema } from './input-mode.schema'
export {
  type LeaderboardEntry,
  type LeaderboardGetRes,
  LeaderboardGetResSchema,
  type LeaderboardQuery,
  LeaderboardQuerySchema,
  type LeaderboardSubmitMeta,
  LeaderboardSubmitMetaSchema,
  type LeaderboardSubmitRes,
  LeaderboardSubmitResSchema,
} from './leaderboards.schema'
export {
  type LifecyclePayload,
  LifecyclePayloadSchema,
  type LifecycleReason,
  type PauseBehavior,
  PauseBehaviorSchema,
} from './lifecycle.schema'
export { type RoundOutcome, RoundOutcomeSchema } from './round.schema'
export {
  type SavesChangedPayload,
  SavesChangedPayloadSchema,
  type SavesFlushRes,
  SavesFlushResSchema,
  type SavesStatus,
  SavesStatusSchema,
} from './saves.schema'
