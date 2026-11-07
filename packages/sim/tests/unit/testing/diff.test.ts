// @vitest-environment node
import type { SnapshotView } from '@mcthaydt/automata-sim'
import { expect, test } from 'vitest'
import { type Difference, diffSnapshotViews } from '#src/testing/diff.ts'
import { formatGoldenReport } from '#src/testing/report.ts'

function view(over: Partial<SnapshotView> = {}): SnapshotView {
  return {
    header: {
      formatVersion: 1,
      schemaHash: 'a'.repeat(16),
      contentHash: 'b'.repeat(16),
      tick: 10,
      tickHz: 60,
    },
    rng: { move: [1, 2, 3, 4], spawn: [5, 6, 7, 8] },
    resources: { 'bounce.stats': { bounces: 3, log: ['a', 'b'] } },
    nextId: 5,
    entities: [
      { sid: 1, components: { 'bounce.ball': { vx: 1, x: 2 }, tag: { name: 'ant' } } },
      { sid: 3, components: { 'bounce.ball': { vx: 0, x: 4 } } },
    ],
    plugins: { physics: { byteLength: 10, hash: 'c'.repeat(16) } },
    ...over,
  }
}

const lines = (diffs: readonly Difference[]): string[] =>
  diffs.map((d) => `${d.at}: ${d.expected} ≠ ${d.actual}`)

test('equal views have no differences', () => {
  expect(diffSnapshotViews(view(), view())).toEqual([])
})

test('every kind of difference, in order: header, rng, resources, entities, plugins', () => {
  const actual = view({
    header: { ...view().header, tick: 11 },
    rng: { move: [1, 2, 9, 4] },
    resources: { 'bounce.stats': { bounces: 4, log: ['a'] } },
    nextId: 6,
    entities: [
      { sid: 1, components: { 'bounce.ball': { vx: 2, x: 2 } } },
      { sid: 4, components: { 'bounce.ball': { vx: 0, x: 4 } } },
    ],
    plugins: { physics: { byteLength: 11, hash: 'd'.repeat(16) } },
  })
  expect(lines(diffSnapshotViews(view(), actual))).toEqual([
    'header tick: 10 ≠ 11',
    'rng move[2]: 3 ≠ 9',
    'rng spawn: present ≠ absent',
    'resource bounce.stats.bounces: 3 ≠ 4',
    'resource bounce.stats.log.length: 2 ≠ 1',
    'resource bounce.stats.log[1]: "b" ≠ absent',
    'nextId: 5 ≠ 6',
    'entity 1 bounce.ball.vx: 1 ≠ 2',
    'entity 1 tag: present ≠ absent',
    'entity 3: present ≠ absent',
    'entity 4: absent ≠ present',
    'plugin physics: 10 bytes cccccccccccccccc ≠ 11 bytes dddddddddddddddd',
  ])
})

test('an entity difference carries its sid', () => {
  const actual = view({
    entities: [view().entities[0] as never, { sid: 3, components: { 'bounce.ball': { vx: 9, x: 4 } } }],
  })
  expect(diffSnapshotViews(view(), actual)).toEqual([
    { kind: 'entity', sid: 3, at: 'entity 3 bounce.ball.vx', expected: '0', actual: '9' },
  ])
})

test('numbers compare with Object.is: -0 differs from 0 and prints as -0', () => {
  const actual = view({
    entities: [view().entities[0] as never, { sid: 3, components: { 'bounce.ball': { vx: -0, x: 4 } } }],
  })
  expect(lines(diffSnapshotViews(view(), actual))).toEqual(['entity 3 bounce.ball.vx: 0 ≠ -0'])
})

test('f32 values print exactly', () => {
  const a = view({ resources: { r: 0.1 } })
  const b = view({ resources: { r: Math.fround(0.1) } })
  expect(lines(diffSnapshotViews(a, b))).toEqual([`resource r: 0.1 ≠ ${String(Math.fround(0.1))}`])
})

test('formatGoldenReport prints the divergence and at most 20 difference lines', () => {
  const differences: Difference[] = Array.from({ length: 23 }, (_, i) => ({
    kind: 'entity',
    sid: i + 1,
    at: `entity ${i + 1} bounce.ball.vx`,
    expected: '3',
    actual: '4',
  }))
  const text = formatGoldenReport({
    kind: 'diverged',
    name: 'route.replay',
    firstTick: 137,
    lastGoodTick: 120,
    exact: true,
    differences,
  })
  const out = text.split('\n')
  expect(out[0]).toBe('route.replay diverged at tick 137 (last matching check: tick 120)')
  expect(out[1]).toBe('  entity 1 bounce.ball.vx: 3 ≠ 4')
  expect(out).toHaveLength(1 + 20 + 1)
  expect(out[21]).toBe('  … and 3 more')
})

test('formatGoldenReport says where differences were taken and when the tick is not exact', () => {
  expect(
    formatGoldenReport({
      kind: 'diverged',
      name: 'bounce.replay',
      firstTick: 137,
      lastGoodTick: 120,
      exact: true,
      diffTick: 140,
      differences: [],
    }).split('\n')[0],
  ).toBe('bounce.replay diverged at tick 137 (last matching check: tick 120); differences at tick 140')
  expect(
    formatGoldenReport({
      kind: 'diverged',
      name: 'bounce.replay',
      firstTick: 180,
      lastGoodTick: 120,
      exact: false,
      differences: [],
    }),
  ).toBe('bounce.replay diverged between tick 120 and tick 180 (no reference data to find the exact tick)')
})
