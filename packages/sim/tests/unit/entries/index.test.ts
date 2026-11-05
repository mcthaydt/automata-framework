import { expect, test } from 'vitest'
import * as sim from '#src/entries/index.ts'
import * as replay from '#src/entries/replay.ts'
import * as math from '#src/shared/math/dmath.ts'

test('the public runtime API is exactly this list (changing it is a deliberate, semver-visible act)', () => {
  expect(Object.getOwnPropertyNames(sim).sort()).toEqual([
    'CanonicalJsonError',
    'PHASES',
    'SIM_VERSION',
    'SNAPSHOT_VERSION',
    'SimCapacityError',
    'SimDisposedError',
    'SimFaultedError',
    'SnapshotFormatError',
    'SnapshotMismatchError',
    'canonicalJson',
    'createRng',
    'createSim',
    'defineCommand',
    'defineComponent',
    'defineEvent',
    'definePlugin',
    'defineResource',
    'defineSystem',
    'deriveSeed',
    'hex64',
    'sortedEntries',
    'sortedKeys',
    'xxhash64',
  ])
})

test('deterministic math is the ./math subpath', () => {
  expect(Object.getOwnPropertyNames(math).sort()).toEqual([
    'atan',
    'atan2',
    'cos',
    'exp',
    'hypot',
    'log',
    'pow',
    'sin',
    'tan',
  ])
})

test('replays are the ./replay subpath', () => {
  expect(Object.getOwnPropertyNames(replay).sort()).toEqual([
    'DEFAULT_CHECK_EVERY',
    'REPLAY_FORMAT',
    'REPLAY_INFLATE_MAX_BYTES',
    'REPLAY_MAX_TICKS',
    'ReplayFormatError',
    'ReplayRecordError',
    'createRecorder',
    'createReplayStepper',
    'decodeReplay',
    'encodeReplay',
    'packReplay',
    'unpackReplay',
  ])
})
