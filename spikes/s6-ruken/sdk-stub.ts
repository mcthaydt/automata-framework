import { isAllowedHostOrigin } from './allowlist'
import {
  type Capability,
  catalogRow,
  type Entitlements,
  type Envelope,
  isEnvelope,
  makeEnvelope,
  type RukenEnv,
  RukenError,
  type WelcomePayload,
} from './protocol'
import { type Backing, createStorage, type StorageLike } from './saves-storage'

export type InitOptions = {
  gameId: string
  wants: readonly Capability[]
  pauseBehavior: 'pause' | 'continue'
  onMenuRequest: () => boolean
}

type LifecycleEvent = { state: 'active' | 'background'; reasons: string[] }
type SavesChanged = { key: string; value: string | null; revision: number }

export type RukenStub = {
  hosted: boolean
  ready: Promise<void>
  granted: ReadonlySet<Capability>
  player: { id: string; displayName: string }
  readonly entitlements: Entitlements
  onEntitlements(fn: (e: Entitlements) => void): () => void
  lifecycle: {
    readonly state: LifecycleEvent['state']
    on(e: 'change', fn: (e: LifecycleEvent) => void): () => void
  }
  saves: {
    storage: StorageLike
    readonly status: string
    on(e: 'status', fn: (s: string) => void): () => void
    onChanged(fn: (c: SavesChanged) => void): () => void
    flush(): Promise<unknown>
  }
  request(type: string, payload: unknown): Promise<unknown>
}

const NO_ENTITLEMENTS: Entitlements = { ads: false, items: [], subscriptions: [], devBuild: false }

export async function initRuken(opts: InitOptions, env: RukenEnv): Promise<RukenStub> {
  const welcome = env.isTopLevel ? null : await handshake(opts, env)
  return welcome ? hosted(opts, env, welcome.payload, welcome.port) : standalone(opts, env)
}

function standalone(opts: InitOptions, env: RukenEnv): RukenStub {
  const prefix = `ruken:${opts.gameId}:`
  const backing: Backing = {
    get: (k) => env.localStorage.getItem(prefix + k),
    set: (k, v) => env.localStorage.setItem(prefix + k, v),
    delete: (k) => env.localStorage.removeItem(prefix + k),
    keys: () => {
      const out: string[] = []
      for (let i = 0; i < env.localStorage.length; i++) {
        const k = env.localStorage.key(i)
        if (k?.startsWith(prefix)) out.push(k.slice(prefix.length))
      }
      return out.sort()
    },
  }
  return {
    hosted: false,
    ready: Promise.resolve(), // standalone: session.ready resolves immediately (P01 §4)
    granted: new Set(),
    player: { id: 'local', displayName: 'Player' },
    entitlements: NO_ENTITLEMENTS,
    onEntitlements: () => () => {},
    lifecycle: { state: 'active', on: () => () => {} },
    saves: {
      storage: createStorage(backing, () => {}),
      status: 'saved',
      on: () => () => {},
      onChanged: () => () => {},
      flush: async () => ({ persisted: 'host-outbox' }),
    },
    request: async (type) => {
      throw new RukenError('UNSUPPORTED', `${type} is unavailable standalone`)
    },
  }
}

function hosted(opts: InitOptions, env: RukenEnv, welcome: WelcomePayload, port: MessagePort): RukenStub {
  const granted = new Set<Capability>(welcome.granted)
  const pending = new Map<
    string,
    { resolve: (p: unknown) => void; reject: (e: Error) => void; timer: unknown }
  >()
  const lifecycleListeners = new Set<(e: LifecycleEvent) => void>()
  const statusListeners = new Set<(s: string) => void>()
  const changedListeners = new Set<(c: SavesChanged) => void>()
  const entitlementListeners = new Set<(e: Entitlements) => void>()
  const cache = new Map<string, string>(Object.entries(welcome.saves.snapshot))
  let lifecycleState: LifecycleEvent['state'] = 'active'
  let savesStatus = welcome.saves.status
  let entitlements = welcome.entitlements
  let writeSeq = 0
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((r) => {
    resolveReady = r
  })

  const send = (env: Envelope) => port.postMessage(env)

  port.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as unknown
    if (!isEnvelope(msg)) return
    if (msg.kind === 'res') {
      const p = msg.re ? pending.get(msg.re) : undefined
      if (!p) return // unknown or late (already timed out): dropped (P01 §5)
      pending.delete(msg.re as string)
      env.clearTimeout(p.timer)
      if (msg.error) p.reject(new RukenError(msg.error.code, msg.error.message, msg.error.retryable))
      else p.resolve(msg.payload)
      return
    }
    if (msg.kind === 'req') {
      if (msg.type === 'menu.open') {
        send(makeEnvelope('res', 'menu.open', { opened: opts.onMenuRequest() !== false }, msg.id))
      } else {
        send({
          ...makeEnvelope('res', msg.type, undefined, msg.id),
          error: { code: 'UNSUPPORTED', message: msg.type, retryable: false },
        })
      }
      return
    }
    switch (msg.type) {
      case 'session.ready':
        resolveReady()
        break
      case 'lifecycle.changed': {
        const e = msg.payload as LifecycleEvent
        lifecycleState = e.state
        for (const l of lifecycleListeners) l(e)
        break
      }
      case 'saves.status':
        savesStatus = (msg.payload as { state: string }).state
        for (const l of statusListeners) l(savesStatus)
        break
      case 'saves.changed': {
        const c = msg.payload as SavesChanged
        if (c.value === null) cache.delete(c.key)
        else cache.set(c.key, c.value)
        for (const l of changedListeners) l(c)
        break
      }
      case 'entitlements.changed':
        entitlements = msg.payload as Entitlements
        for (const l of entitlementListeners) l(entitlements)
        break
      default:
        break // unknown or not-yet-implemented evt: ignored (P01 §5)
    }
  })
  port.start()

  function request(type: string, payload: unknown): Promise<unknown> {
    const row = catalogRow(type)
    if (row?.kind !== 'req' || row.dir !== 'G→H') return Promise.reject(new RukenError('UNSUPPORTED', type))
    const req = makeEnvelope('req', type, payload)
    return new Promise((resolve, reject) => {
      const timer = env.setTimeout(() => {
        pending.delete(req.id)
        reject(new RukenError('TIMEOUT', `${type} after ${row.timeoutMs} ms`, true))
      }, row.timeoutMs ?? 5_000)
      pending.set(req.id, { resolve, reject, timer })
      send(req)
    })
  }

  const backing: Backing = {
    get: (k) => cache.get(k) ?? null,
    set: (k, v) => void cache.set(k, v),
    delete: (k) => void cache.delete(k),
    keys: () => [...cache.keys()].sort(),
  }
  const storage = createStorage(
    backing,
    (op) => {
      writeSeq += 1
      const writeId = `${opts.gameId}-w${writeSeq}` // unique per session; uniqueness scope is a P01 gap item
      if (op.kind === 'set')
        send(makeEnvelope('evt', 'saves.set', { key: op.key, value: op.value, baseRevision: null, writeId }))
      else send(makeEnvelope('evt', 'saves.remove', { key: op.key, baseRevision: null, writeId }))
    },
    () => {
      if (!granted.has('saves')) throw new RukenError('DENIED', 'saves capability not granted')
    },
  )

  return {
    hosted: true,
    ready,
    granted,
    player: welcome.player,
    get entitlements() {
      return entitlements
    },
    onEntitlements: (fn) => {
      entitlementListeners.add(fn)
      return () => entitlementListeners.delete(fn)
    },
    lifecycle: {
      get state() {
        return lifecycleState
      },
      on: (_e, fn) => {
        lifecycleListeners.add(fn)
        return () => lifecycleListeners.delete(fn)
      },
    },
    saves: {
      storage,
      get status() {
        return savesStatus
      },
      on: (_e, fn) => {
        statusListeners.add(fn)
        return () => statusListeners.delete(fn)
      },
      onChanged: (fn) => {
        changedListeners.add(fn)
        return () => changedListeners.delete(fn)
      },
      flush: () => request('saves.flush', {}),
    },
    request,
  }
}

function handshake(
  opts: InitOptions,
  env: RukenEnv,
): Promise<{ payload: WelcomePayload; port: MessagePort } | null> {
  return new Promise((resolve) => {
    const hello = makeEnvelope('evt', 'hello', {
      sdkVersion: '0.0.0-spike',
      proto: { min: '1.0', max: '1.x' },
      gameId: opts.gameId,
      wants: [...opts.wants],
      pauseBehavior: opts.pauseBehavior,
      menu: true,
    })
    let done = false
    let retry: unknown
    const finish = (v: { payload: WelcomePayload; port: MessagePort } | null) => {
      if (done) return // a second welcome is ignored (P01 §4)
      done = true
      env.clearTimeout(retry)
      env.clearTimeout(giveUp)
      off()
      resolve(v)
    }
    const off = env.addMessageListener((ev) => {
      if (!isEnvelope(ev.data) || ev.data.type !== 'welcome') return
      if (ev.source !== env.parent) return // forged welcome (e.g. a game posting to itself): ignored
      if (!isAllowedHostOrigin(ev.origin, env.gameOrigin)) return // dropped silently; keep retrying
      const port = ev.ports[0]
      if (port) finish({ payload: ev.data.payload as WelcomePayload, port })
    })
    const send = () => {
      if (done) return
      env.postToParent(hello)
      retry = env.setTimeout(send, 250)
    }
    const giveUp = env.setTimeout(() => finish(null), 10_000)
    send()
  })
}
