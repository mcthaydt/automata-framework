import { describe, expect, it } from 'vitest'
import * as host from './index'
import * as testing from './testing'

describe('public entry points', () => {
  it('export the target-neutral contract, and no adapter (DIST spec §4, §5.3)', () => {
    expect(Object.keys(host).sort()).toEqual(
      [
        'AudioChangeSchema',
        'CAPABILITIES',
        'CapabilitySchema',
        'DisplayMetricsPayloadSchema',
        'ERROR_CODES',
        'EntitlementsPayloadSchema',
        'ErrorCodeSchema',
        'FullscreenResSchema',
        'HOST_EXIT_CAP',
        'HostError',
        'HostHandshakeFailed',
        'Hosting',
        'InputModePayloadSchema',
        'LeaderboardGetResSchema',
        'LeaderboardQuerySchema',
        'LeaderboardSubmitMetaSchema',
        'LeaderboardSubmitResSchema',
        'LifecyclePayloadSchema',
        'PauseBehaviorSchema',
        'RUKEN_SDK_MARKERS',
        'RoundOutcomeSchema',
        'SavesChangedPayloadSchema',
        'SavesFlushResSchema',
        'SavesStatusSchema',
        'findRukenSdkMarkers',
        'findTauriMarkers',
        'TAURI_MARKERS',
      ].sort(),
    )
  })

  it('export the fake-host test layer and its clocks from ./testing', () => {
    expect(Object.keys(testing).sort()).toEqual(
      ['FakeHostHandle', 'HostingTest', 'TEST_GAME_ORIGIN', 'manualClock', 'realClock', 'runScoped'].sort(),
    )
  })
})
