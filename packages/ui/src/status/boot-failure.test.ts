import { describe, expect, it } from 'vitest'
import { BOOT_FAILURE_COPY_EN, type BootFailure, bootFailureView, withHostName } from './boot-failure'

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
    [{ _tag: 'HostError', code: 'TIMEOUT', retryable: true, operation: 'init' }, 'ruken', 'start', ['retry']],
    [
      { _tag: 'HostError', code: 'INVALID_PAYLOAD', retryable: false, operation: 'init' },
      'ruken',
      'start',
      [],
    ],
    [
      { _tag: 'HostError', code: 'INVALID_PAYLOAD', retryable: false, operation: 'init' },
      'standalone',
      'start',
      [],
    ],
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
    [{ _tag: 'BootDefect' }, 'ruken', 'start', ['retry']],
    [{ _tag: 'BootDefect' }, 'standalone', 'start', ['retry']],
    [{ _tag: 'ModelInvalid', file: 'm.glb', reason: 'skinned' }, 'ruken', 'model-invalid', ['retry']],
    [{ _tag: 'ModelInvalid', file: 'm.glb', reason: 'malformed' }, 'standalone', 'model-invalid', ['retry']],
  ] as const)('%j under %s is %s with %j', (failure, host, state, actions) => {
    // Ruken always grants `exit` (sdk-host ALWAYS_GRANTED); the SDK's standalone session grants nothing.
    expect(bootFailureView(failure, host, host === 'ruken')).toEqual({ state, actions: [...actions] })
  })

  describe('"Back to …" only when the host grants exit (PUB spec §3.1)', () => {
    it('a Ruken session without exit makes a non-retryable saves failure final instead of offering exit', () => {
      expect(bootFailureView(saves(false), 'ruken', false)).toEqual({ state: 'progress', actions: [] })
    })

    it('a Ruken session without exit makes a renderer failure final', () => {
      expect(bootFailureView({ _tag: 'RendererUnavailable', tried: ['webgl2'] }, 'ruken', false)).toEqual({
        state: 'unsupported',
        actions: [],
      })
    })

    it('a standalone page still offers Continue, whatever it grants', () => {
      expect(bootFailureView(saves(false), 'standalone', true).actions).toEqual(['continue'])
    })
  })

  describe('the exit label names the host (PUB spec §3)', () => {
    it("keeps a {host} slot in the default copy, so it reads the host's own name", () => {
      expect(BOOT_FAILURE_COPY_EN.exit).toBe('Back to {host}')
    })

    it.each([
      ['Ruken', 'Back to Ruken'],
      ['itch.io', 'Back to itch.io'],
    ])('fills {host} with %s', (hostName, label) => {
      expect(withHostName(BOOT_FAILURE_COPY_EN.exit, hostName)).toBe(label)
    })

    it("leaves a game's fixed copy as it is", () => {
      expect(withHostName('Volver', 'Ruken')).toBe('Volver')
    })
  })

  it('has English copy for every state and action', () => {
    for (const key of [
      'start',
      'connect',
      'progress',
      'damaged',
      'download',
      'download-stalled',
      'unsupported',
      'model-invalid',
      'retry',
      'continue',
      'exit',
    ] as const) {
      expect(BOOT_FAILURE_COPY_EN[key].length).toBeGreaterThan(0)
    }
  })
})
