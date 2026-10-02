// Ruken protocol v1.0, transcribed from RukenApp/docs/superpowers/specs/2026-10-01-ruken-p01-protocol-sdk-design.md
// (§5 envelope, §6 capabilities, §7 catalog). Re-check against P01 before A2: it is not frozen until F1 (2026-10-16).

export type ErrorCode =
  | 'UNSUPPORTED'
  | 'NOT_READY'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_PAYLOAD'
  | 'DENIED'
  | 'OFFLINE'
  | 'CANCELLED'
  | 'INTERNAL'

export type Envelope = {
  ruken: 1
  id: string
  kind: 'req' | 'res' | 'evt'
  type: string
  re?: string
  payload?: unknown
  error?: { code: ErrorCode; message: string; retryable: boolean }
}

export type Capability =
  | 'lifecycle'
  | 'input'
  | 'display'
  | 'audio'
  | 'exit'
  | 'menu'
  | 'saves'
  | 'leaderboards'
  | 'entitlements'
  | 'store'
  | 'ads'
  | 'telemetry'
  | 'analytics.custom'
  | 'links'

export const ALWAYS_GRANTED: readonly Capability[] = [
  'lifecycle',
  'input',
  'display',
  'audio',
  'exit',
  'telemetry',
]

export type HelloPayload = {
  sdkVersion: string
  proto: { min: string; max: string }
  gameId: string
  wants: Capability[]
  pauseBehavior: 'pause' | 'continue'
  menu: boolean
}

export type Entitlements = {
  ads: boolean
  items: string[]
  subscriptions: Array<{
    sku: string
    plan: 'monthly' | 'season'
    active: boolean
    seasonId?: string
    endsAt?: string
  }>
  devBuild: boolean
}

export type WelcomePayload = {
  proto: string
  granted: Capability[]
  player: { id: string; displayName: string }
  locale: string
  input: {
    mode: 'touch' | 'keyboard-mouse' | 'gamepad'
    gamepad?: { layout: 'xbox' | 'other'; connected: boolean }
  }
  display: {
    safeArea: { top: number; right: number; bottom: number; left: number }
    hostReserved: { edge: 'right' | 'left'; rect: { x: number; y: number; w: number; h: number } }
    orientation: string
    fullscreen: boolean
    scale: 1 | 1.333
  }
  audio: { focus: 'full' | 'ducked' | 'muted'; master: { volume: number; muted: boolean } }
  entitlements: Entitlements
  saves: { snapshot: Record<string, string>; status: string }
  consent: { analytics: boolean }
  host: { kind: 'web' | 'desktop'; version: string }
}

export type CatalogRow = {
  type: string
  kind: 'req' | 'evt'
  dir: 'G→H' | 'H→G'
  cap: Capability | null
  timeoutMs: number | null
}

/** P01 §7 message catalog (v1.0), one row per message type. */
export const CATALOG: readonly CatalogRow[] = [
  { type: 'hello', kind: 'evt', dir: 'G→H', cap: null, timeoutMs: null },
  { type: 'welcome', kind: 'evt', dir: 'H→G', cap: null, timeoutMs: null },
  { type: 'session.ready', kind: 'evt', dir: 'H→G', cap: null, timeoutMs: null },
  { type: 'lifecycle.changed', kind: 'evt', dir: 'H→G', cap: 'lifecycle', timeoutMs: null },
  { type: 'input.mode', kind: 'evt', dir: 'H→G', cap: 'input', timeoutMs: null },
  { type: 'host.summon', kind: 'evt', dir: 'G→H', cap: 'input', timeoutMs: null },
  { type: 'display.metrics', kind: 'evt', dir: 'H→G', cap: 'display', timeoutMs: null },
  { type: 'display.fullscreen', kind: 'req', dir: 'G→H', cap: 'display', timeoutMs: 3_000 },
  { type: 'audio.focus', kind: 'evt', dir: 'H→G', cap: 'audio', timeoutMs: null },
  { type: 'audio.master', kind: 'evt', dir: 'H→G', cap: 'audio', timeoutMs: null },
  { type: 'session.exit', kind: 'req', dir: 'G→H', cap: 'exit', timeoutMs: 2_000 },
  { type: 'session.exiting', kind: 'evt', dir: 'H→G', cap: 'exit', timeoutMs: null },
  { type: 'session.exitReady', kind: 'evt', dir: 'G→H', cap: 'exit', timeoutMs: null },
  { type: 'menu.open', kind: 'req', dir: 'H→G', cap: 'menu', timeoutMs: 1_000 },
  { type: 'saves.set', kind: 'evt', dir: 'G→H', cap: 'saves', timeoutMs: null },
  { type: 'saves.remove', kind: 'evt', dir: 'G→H', cap: 'saves', timeoutMs: null },
  { type: 'saves.flush', kind: 'req', dir: 'G→H', cap: 'saves', timeoutMs: 5_000 },
  { type: 'saves.status', kind: 'evt', dir: 'H→G', cap: 'saves', timeoutMs: null },
  { type: 'saves.changed', kind: 'evt', dir: 'H→G', cap: 'saves', timeoutMs: null },
  { type: 'leaderboard.submit', kind: 'req', dir: 'G→H', cap: 'leaderboards', timeoutMs: 5_000 },
  { type: 'leaderboard.get', kind: 'req', dir: 'G→H', cap: 'leaderboards', timeoutMs: 5_000 },
  { type: 'entitlements.changed', kind: 'evt', dir: 'H→G', cap: 'entitlements', timeoutMs: null },
  { type: 'store.purchase', kind: 'req', dir: 'G→H', cap: 'store', timeoutMs: 600_000 },
  { type: 'store.manage', kind: 'req', dir: 'G→H', cap: 'store', timeoutMs: 600_000 },
  { type: 'ads.break', kind: 'req', dir: 'G→H', cap: 'ads', timeoutMs: 120_000 },
  { type: 'telemetry.activity', kind: 'evt', dir: 'G→H', cap: 'telemetry', timeoutMs: null },
  { type: 'telemetry.perf', kind: 'evt', dir: 'G→H', cap: 'telemetry', timeoutMs: null },
  { type: 'telemetry.error', kind: 'evt', dir: 'G→H', cap: 'telemetry', timeoutMs: null },
  { type: 'analytics.track', kind: 'evt', dir: 'G→H', cap: 'analytics.custom', timeoutMs: null },
  { type: 'consent.changed', kind: 'evt', dir: 'H→G', cap: null, timeoutMs: null },
  { type: 'links.open', kind: 'req', dir: 'G→H', cap: 'links', timeoutMs: 30_000 },
]

export const catalogRow = (type: string): CatalogRow | undefined => CATALOG.find((r) => r.type === type)

export class RukenError extends Error {
  readonly code: ErrorCode
  readonly retryable: boolean
  constructor(code: ErrorCode, message: string, retryable = false) {
    super(`${code}: ${message}`)
    this.name = code === 'QUOTA_EXCEEDED' ? 'QuotaExceededError' : 'RukenError'
    this.code = code
    this.retryable = retryable
  }
}

let counter = 0
export function makeEnvelope(kind: Envelope['kind'], type: string, payload?: unknown, re?: string): Envelope {
  counter += 1
  const env: Envelope = { ruken: 1, id: `m${counter}`, kind, type }
  if (payload !== undefined) env.payload = payload
  if (re !== undefined) env.re = re
  return env
}

export function isEnvelope(v: unknown): v is Envelope {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    e.ruken === 1 &&
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    (e.kind === 'req' || e.kind === 'res' || e.kind === 'evt')
  )
}

/** Everything the SDK needs from its window. Real browsers use dom-env.ts; Node tests use mock-host.ts. */
export type RukenEnv = {
  isTopLevel: boolean
  parent: unknown // identity only: welcome must come from this source
  gameOrigin: string
  postToParent(msg: unknown): void
  addMessageListener(
    fn: (ev: { data: unknown; origin: string; source: unknown; ports: readonly MessagePort[] }) => void,
  ): () => void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
  localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
}
