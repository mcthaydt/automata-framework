import { describe, expect, it } from 'vitest'
import * as host from '#src/entries/host-contract.ts'
import * as testing from '#src/testing/host/page/index.ts'

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
        'HOST_EXIT_CAP_MS',
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

  it('export the Ruken fake-host session and its clocks from ./testing', () => {
    expect(Object.keys(testing).sort()).toEqual(
      ['TEST_GAME_ORIGIN', 'manualClock', 'openHostingTest', 'realClock', 'withHostingTest'].sort(),
    )
  })
})
