import type * as Ruken from '@ruken/sdk'
import { describe, expectTypeOf, it } from 'vitest'
import type * as Af from '#src/shared/host/index.ts'

// DIST spec §4.1: AF owns the host contract and keeps Ruken's names where they fit. These checks hold AF's
// contract to the vendored SDK, so a re-vendor that changes a Ruken name or payload fails here (in `tsc`, which
// `pnpm check` runs) instead of drifting. The Ruken adapter relays Ruken's values as AF's (Ruken → AF) and passes
// a game's requests to the SDK (AF → Ruken).

describe("AF's host contract against the vendored Ruken SDK", () => {
  it('has the same capability names and error codes', () => {
    expectTypeOf<Af.Capability>().toEqualTypeOf<Ruken.Capability>()
    expectTypeOf<Af.ErrorCode>().toEqualTypeOf<Ruken.RukenError['code']>()
  })

  it("accepts every value Ruken reports (Ruken's payloads are assignable to AF's)", () => {
    expectTypeOf<Ruken.LifecyclePayload>().toExtend<Af.LifecyclePayload>()
    expectTypeOf<Ruken.InputModePayload>().toExtend<Af.InputModePayload>()
    expectTypeOf<Ruken.DisplayMetricsPayload>().toExtend<Af.DisplayMetricsPayload>()
    expectTypeOf<Ruken.FullscreenRes>().toExtend<Af.FullscreenRes>()
    expectTypeOf<Ruken.AudioChange>().toExtend<Af.AudioChange>()
    expectTypeOf<Ruken.SavesStatus>().toExtend<Af.SavesStatus>()
    expectTypeOf<Ruken.SavesFlushRes>().toExtend<Af.SavesFlushRes>()
    expectTypeOf<Ruken.SavesChangedPayload>().toExtend<Af.SavesChangedPayload>()
    expectTypeOf<Ruken.EntitlementsPayload>().toExtend<Af.EntitlementsPayload>()
    expectTypeOf<Ruken.LeaderboardSubmitRes>().toExtend<Af.LeaderboardSubmitRes>()
    expectTypeOf<Ruken.LeaderboardGetRes>().toExtend<Af.LeaderboardGetRes>()
  })

  it("passes every request a game makes to the SDK (AF's requests are assignable to Ruken's)", () => {
    expectTypeOf<Af.PauseBehavior>().toEqualTypeOf<Ruken.PauseBehavior>()
    expectTypeOf<Af.RoundOutcome>().toEqualTypeOf<Ruken.RoundOutcome>()
    expectTypeOf<Af.LeaderboardSubmitMeta>().toEqualTypeOf<
      Parameters<Ruken.LeaderboardsApi['submit']>[2] & {}
    >()
    expectTypeOf<Af.LeaderboardQuery>().toEqualTypeOf<Parameters<Ruken.LeaderboardsApi['get']>[1] & {}>()
  })
})
