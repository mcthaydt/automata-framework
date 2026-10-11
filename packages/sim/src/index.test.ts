import { expect, test } from 'vitest'
import * as sim from './index'
import * as math from './math/dmath'

test('the public runtime API is exactly this list (changing it is a deliberate, semver-visible act)', () => {
  expect(Object.getOwnPropertyNames(sim).sort()).toEqual([
    'CanonicalJsonError',
    'PHASES',
    'SNAPSHOT_VERSION',
    'SimCapacityError',
    'SimDisposedError',
    'SimFaultedError',
    'SnapshotFormatError',
    'SnapshotMismatchError',
    'canonicalJson',
    'createSim',
    'defineCommand',
    'defineComponent',
    'defineEvent',
    'definePlugin',
    'defineResource',
    'defineSystem',
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
