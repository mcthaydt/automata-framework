import { describe, expect, it } from 'vitest'
import { BOOT_FAILURE_COPY_EN, type BootFailure, bootFailureView } from './boot-failure'

// One state per BootError tag (M1 shared contracts §3; M1.6 spec §3.6).
const saves = (retryable: boolean): BootFailure => ({
  _tag: 'HostError',
  code: 'TIMEOUT',
  retryable,
  operation: 'saves.get',
})

describe('bootFailureView', () => {
  it.each([
    [saves(true), 'ruken', 'progress', ['retry']],
    [saves(true), 'standalone', 'progress', ['retry']],
    [saves(false), 'standalone', 'progress', ['continue']],
    [saves(false), 'ruken', 'progress', ['exit']],
    [
      { _tag: 'HostError', code: 'TIMEOUT', retryable: true, operation: 'ready' },
      'ruken',
      'connect',
      ['retry'],
    ],
    [{ _tag: 'ContentHashMismatch', expected: 'a', actual: 'b' }, 'ruken', 'damaged', ['retry']],
    [{ _tag: 'AssetLoadFailed', url: '/a.png', status: 404 }, 'standalone', 'download', ['retry']],
    [
      { _tag: 'LoadStalled', url: '/a.png', bytesSoFar: 10, stalledMs: 30_000 },
      'ruken',
      'download-stalled',
      ['retry'],
    ],
    [{ _tag: 'RendererUnavailable', tried: ['webgl2'] }, 'ruken', 'unsupported', ['exit']],
    [{ _tag: 'RendererUnavailable', tried: ['webgl2', 'webgpu'] }, 'standalone', 'unsupported', []],
  ] as const)('%j under %s is %s with %j', (failure, host, state, actions) => {
    expect(bootFailureView(failure, host)).toEqual({ state, actions: [...actions] })
  })

  it('has English copy for every state and action', () => {
    for (const key of [
      'connect',
      'progress',
      'damaged',
      'download',
      'download-stalled',
      'unsupported',
      'retry',
      'continue',
      'exit',
    ] as const) {
      expect(BOOT_FAILURE_COPY_EN[key].length).toBeGreaterThan(0)
    }
  })
})
