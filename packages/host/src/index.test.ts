import { describe, expect, it } from 'vitest'
import * as host from './index'
import * as testing from './testing'

describe('public entry points', () => {
  it('export the Hosting contract and its one live layer', () => {
    expect(Object.keys(host).sort()).toEqual(
      [
        'HOST_EXIT_CAP',
        'RUKEN_SDK_MARKERS',
        'findRukenSdkMarkers',
        'HostError',
        'HostHandshakeFailed',
        'Hosting',
        'HostingLive',
        'makeHosting',
        'toHostError',
      ].sort(),
    )
  })

  it('export the fake-host test layer and its clocks from ./testing', () => {
    expect(Object.keys(testing).sort()).toEqual(
      ['FakeHostHandle', 'HostingTest', 'TEST_GAME_ORIGIN', 'manualClock', 'realClock', 'runScoped'].sort(),
    )
  })
})
