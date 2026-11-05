import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  AssetLoadFailed,
  BootDefect,
  type BootError,
  ContentHashMismatch,
  LoadStalled,
  ModelInvalid,
  RendererUnavailable,
} from '#src/shared/runtime/boot-error.ts'
import { HostError } from '../../../../src/shared/host/errors.ts'
import { type BootFailure, bootFailureView } from '../../../../src/shared/ui/status/boot-failure.ts'

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
    [new ModelInvalid({ file: 'models/crate.glb', reason: 'skinned' }), 'model-invalid'],
  ])('maps %j to expected UI state %s', (instance, expectedState) => {
    expect(bootFailureView(instance, 'ruken', true).state).toBe(expectedState)
  })
})
