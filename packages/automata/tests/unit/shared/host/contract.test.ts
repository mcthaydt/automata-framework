import { describe, expect, it } from 'vitest'
import * as host from '#src/entries/host-contract.ts'

// DIST spec §4.1: AF's host contract, defined in this package. The names are Ruken's where they fit;
// `ruken/conformance.test.ts` holds them to the vendored SDK.

describe('the host contract names', () => {
  it('lists the capabilities a game may ask for', () => {
    expect(host.CAPABILITIES).toEqual([
      'lifecycle',
      'input',
      'display',
      'audio',
      'exit',
      'menu',
      'saves',
      'leaderboards',
      'entitlements',
      'store',
      'ads',
      'telemetry',
      'analytics.custom',
      'links',
    ])
  })

  it('lists the error codes a host call may fail with', () => {
    expect(host.ERROR_CODES).toEqual([
      'UNSUPPORTED',
      'NOT_READY',
      'TIMEOUT',
      'RATE_LIMITED',
      'QUOTA_EXCEEDED',
      'INVALID_PAYLOAD',
      'DENIED',
      'OFFLINE',
      'CANCELLED',
      'INTERNAL',
    ])
  })
})

describe('the host contract schemas', () => {
  const valid: [string, { safeParse(value: unknown): { success: boolean } }, unknown, unknown][] = [
    ['capability', host.CapabilitySchema, 'saves', 'files'],
    ['error code', host.ErrorCodeSchema, 'DENIED', 'NOPE'],
    ['pause behavior', host.PauseBehaviorSchema, 'pause', 'stop'],
    [
      'lifecycle',
      host.LifecyclePayloadSchema,
      { state: 'background', reasons: ['hidden'] },
      { state: 'asleep', reasons: [] },
    ],
    [
      'input mode',
      host.InputModePayloadSchema,
      { mode: 'gamepad', gamepad: { layout: 'xbox', connected: true } },
      { mode: 'mouse' },
    ],
    [
      'display metrics',
      host.DisplayMetricsPayloadSchema,
      {
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
        hostReserved: { edge: 'right', rect: { x: 0, y: 0, w: 0, h: 0 } },
        orientation: 'landscape',
        fullscreen: false,
        scale: 1.333,
      },
      {
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
        hostReserved: { edge: 'top', rect: { x: 0, y: 0, w: 0, h: 0 } },
        orientation: 'landscape',
        fullscreen: false,
        scale: 2,
      },
    ],
    [
      'fullscreen',
      host.FullscreenResSchema,
      { fullscreen: true, support: 'element' },
      { fullscreen: true, support: 'api' },
    ],
    [
      'audio',
      host.AudioChangeSchema,
      { focus: { state: 'ducked', reason: 'ad' }, master: { volume: 0.5, muted: false }, gain: 0.25 },
      { focus: { state: 'loud', reason: 'ad' }, master: { volume: 0.5, muted: false }, gain: 0.25 },
    ],
    ['saves status', host.SavesStatusSchema, 'offline-queued', 'lost'],
    [
      'saves changed',
      host.SavesChangedPayloadSchema,
      { key: 'slot-1', value: null, revision: 3 },
      { key: 'slot-1', revision: 3 },
    ],
    [
      'entitlements',
      host.EntitlementsPayloadSchema,
      {
        ads: false,
        items: ['dlc-1'],
        subscriptions: [{ sku: 'pass', plan: 'season', active: true }],
        devBuild: false,
      },
      {
        ads: false,
        items: [],
        subscriptions: [{ sku: 'pass', plan: 'yearly', active: true }],
        devBuild: false,
      },
    ],
    ['leaderboard meta', host.LeaderboardSubmitMetaSchema, { level: 3, mode: 'hard' }, { level: true }],
    [
      'leaderboard query',
      host.LeaderboardQuerySchema,
      { scope: 'around-me', limit: 10 },
      { scope: 'friends' },
    ],
    [
      'leaderboard submit',
      host.LeaderboardSubmitResSchema,
      { accepted: true, personalBest: 120, rank: 4 },
      { accepted: true },
    ],
    [
      'leaderboard get',
      host.LeaderboardGetResSchema,
      { entries: [{ rank: 1, displayName: 'Ada', score: 120, isMe: true }] },
      { entries: [{ rank: 1, displayName: 'Ada', score: '120', isMe: true }] },
    ],
    ['round outcome', host.RoundOutcomeSchema, 'complete', 'won'],
  ]

  it.each(valid)(
    'the %s schema parses a valid value and rejects an invalid one',
    (_name, schema, good, bad) => {
      expect(schema.safeParse(good).success).toBe(true)
      expect(schema.safeParse(bad).success).toBe(false)
    },
  )

  it('names device storage as where a flush persisted (DIST-D3)', () => {
    for (const persisted of ['host-outbox', 'server', 'device']) {
      expect(host.SavesFlushResSchema.safeParse({ persisted }).success).toBe(true)
    }
    expect(host.SavesFlushResSchema.safeParse({ persisted: 'memory' }).success).toBe(false)
  })
})
