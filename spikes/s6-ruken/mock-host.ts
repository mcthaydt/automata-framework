import {
  ALWAYS_GRANTED,
  type Capability,
  type Envelope,
  type ErrorCode,
  type HelloPayload,
  isEnvelope,
  makeEnvelope,
  type RukenEnv,
  type WelcomePayload,
} from './protocol'

type GameListener = Parameters<RukenEnv['addMessageListener']>[0]
type GameEvent = Parameters<GameListener>[0]

/** A fake game window: `parentWindow` and `selfWindow` are identity tokens for event.source checks. */
export type FakeFrame = {
  gameEnv: RukenEnv
  hostOrigin: string | null
  parentWindow: object
  selfWindow: object
  storage: Map<string, string>
  helloCount(): number
  onHello(fn: (hello: Envelope) => void): void
  deliverToGame(ev: GameEvent): void
}

export function createFakeFrame(o: { gameOrigin: string; hostOrigin: string | null }): FakeFrame {
  const listeners = new Set<GameListener>()
  const parentWindow = {}
  const selfWindow = {}
  let hellos = 0
  let helloHandler: ((h: Envelope) => void) | undefined
  const storage = new Map<string, string>()
  const gameEnv: RukenEnv = {
    isTopLevel: o.hostOrigin === null,
    parent: o.hostOrigin === null ? selfWindow : parentWindow,
    gameOrigin: o.gameOrigin,
    postToParent(msg) {
      if (isEnvelope(msg) && msg.type === 'hello') {
        hellos += 1
        helloHandler?.(msg)
      }
    },
    addMessageListener(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>),
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => void storage.set(k, v),
      removeItem: (k) => void storage.delete(k),
      key: (i) => [...storage.keys()][i] ?? null,
      get length() {
        return storage.size
      },
    },
  }
  return {
    gameEnv,
    hostOrigin: o.hostOrigin,
    parentWindow,
    selfWindow,
    storage,
    helloCount: () => hellos,
    onHello: (fn) => {
      helloHandler = fn
    },
    deliverToGame: (ev) => {
      for (const l of listeners) l(ev)
    },
  }
}

export const baseWelcome = (granted: Capability[], snapshot: Record<string, string>): WelcomePayload => ({
  proto: '1.0',
  granted,
  player: { id: 'p_opaque', displayName: 'Tester' },
  locale: 'en',
  input: { mode: 'keyboard-mouse' },
  display: {
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    hostReserved: { edge: 'right', rect: { x: 0, y: 0, w: 48, h: 56 } },
    orientation: 'landscape',
    fullscreen: false,
    scale: 1,
  },
  audio: { focus: 'full', master: { volume: 1, muted: false } },
  entitlements: { ads: false, items: [], subscriptions: [], devBuild: true },
  saves: { snapshot, status: 'saved' },
  consent: { analytics: false },
  host: { kind: 'web', version: 'mock' },
})

export type MockHost = {
  inbox: Envelope[]
  send(env: Envelope): void
  sendEvt(type: string, payload: unknown): void
  request(type: string, payload: unknown): Promise<Envelope>
  received(type: string): unknown[]
  /** Round trip that guarantees every earlier game->host message has been delivered. */
  sync(): Promise<void>
}

export function createMockHost(o: {
  frame: FakeFrame
  offered: Capability[]
  saves: Record<string, string>
  respond?: { [type: string]: { error: ErrorCode; retryable?: boolean } | 'silent' | 'late' }
}): MockHost {
  let port: MessagePort | undefined
  const inbox: Envelope[] = []
  const waiting = new Map<string, (e: Envelope) => void>()
  const syncWaiters: Array<() => void> = []
  o.frame.onHello((hello) => {
    const hostOrigin = o.frame.hostOrigin
    if (port || hostOrigin === null) return
    const channel = new MessageChannel()
    ;(channel.port1 as unknown as { unref?: () => void }).unref?.() // don't keep the test process alive
    ;(channel.port2 as unknown as { unref?: () => void }).unref?.()
    port = channel.port1
    port.addEventListener('message', (ev: MessageEvent) => {
      const msg = ev.data as unknown
      if (!isEnvelope(msg)) return
      inbox.push(msg)
      if (msg.kind === 'res' && msg.re) {
        waiting.get(msg.re)?.(msg)
        waiting.delete(msg.re)
        return
      }
      if (msg.kind !== 'req') return
      const rule = o.respond?.[msg.type]
      if (rule === 'silent') return
      if (rule && rule !== 'late') {
        port?.postMessage({
          ...makeEnvelope('res', msg.type, undefined, msg.id),
          error: { code: rule.error, message: 'mock', retryable: rule.retryable ?? false },
        })
        return
      }
      const reply = () =>
        port?.postMessage(makeEnvelope('res', msg.type, { persisted: 'host-outbox' }, msg.id))
      if (rule === 'late') globalThis.setTimeout(reply, 6_000)
      else reply()
      if (msg.type === 'saves.flush') for (const w of syncWaiters.splice(0)) w()
    })
    port.start()
    const wants = (hello.payload as HelloPayload).wants
    const granted = o.offered.filter((c) => ALWAYS_GRANTED.includes(c) || wants.includes(c))
    o.frame.deliverToGame({
      data: makeEnvelope('evt', 'welcome', baseWelcome(granted, o.saves)),
      origin: hostOrigin,
      source: o.frame.parentWindow,
      ports: [channel.port2],
    })
  })
  const host: MockHost = {
    inbox,
    send: (env) => port?.postMessage(env),
    sendEvt: (type, payload) => port?.postMessage(makeEnvelope('evt', type, payload)),
    request: (type, payload) =>
      new Promise((resolve) => {
        const req = makeEnvelope('req', type, payload)
        waiting.set(req.id, resolve)
        port?.postMessage(req)
      }),
    received: (type) => inbox.filter((m) => m.type === type).map((m) => m.payload),
    sync: async () => {
      // menu.open is H->G, so the game answers it on the same ordered port: everything sent before has arrived.
      await host.request('menu.open', {})
    },
  }
  return host
}
