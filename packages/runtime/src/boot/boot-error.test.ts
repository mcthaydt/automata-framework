import { HostError } from '@mcthaydt/automata-host'
import { type BootFailure, bootFailureView } from '@mcthaydt/automata-ui'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  AssetLoadFailed,
  BootDefect,
  type BootError,
  ContentHashMismatch,
  LoadStalled,
  RendererUnavailable,
} from './boot-error.js'

describe('BootError', () => {
  it('is structurally assignable to UI BootFailure', () => {
    expectTypeOf<BootError>().toMatchTypeOf<BootFailure>()
  })

  it.each([
    [new HostError({ code: 'TIMEOUT', retryable: true, operation: 'init' }), 'start'],
    [new ContentHashMismatch({ expected: 'abc', actual: 'def' }), 'damaged'],
    [new AssetLoadFailed({ url: '/asset.png', status: 404 }), 'download'],
    [new LoadStalled({ url: '/asset.png', bytesSoFar: 100, stalledMs: 30000 }), 'download-stalled'],
    [new RendererUnavailable({ tried: ['webgl2'] }), 'unsupported'],
    [new BootDefect({ cause: new Error('boom') }), 'start'],
  ])('maps %j to expected UI state %s', (instance, expectedState) => {
    expect(bootFailureView(instance, 'ruken').state).toBe(expectedState)
  })
})
