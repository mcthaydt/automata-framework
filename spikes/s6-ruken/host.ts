import { baseWelcome } from './mock-host'
import { isEnvelope, makeEnvelope } from './protocol'

// Served on http://127.0.0.1:<port>; the game iframe is http://localhost:<port> (a different origin).
const gameOrigin = `http://localhost:${location.port}`
const iframe = document.createElement('iframe')
iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock')
iframe.src = `${gameOrigin}${location.pathname.replace('host.html', 'game.html')}`
document.body.append(iframe)

const out: Record<string, unknown> = { ok: false, hellos: 0, droppedWrongSource: 0 }
const finish = () => {
  ;(window as unknown as { __result: unknown }).__result = out
}
let port: MessagePort | undefined
let readyAt = 0

window.addEventListener('message', (ev) => {
  if (!isEnvelope(ev.data) || ev.data.type !== 'hello') return
  if (ev.source !== iframe.contentWindow || ev.origin !== gameOrigin) {
    out.droppedWrongSource = (out.droppedWrongSource as number) + 1
    return
  }
  out.hellos = (out.hellos as number) + 1
  if (port) return
  const channel = new MessageChannel()
  port = channel.port1
  port.onmessage = (e: MessageEvent) => {
    const msg = e.data as unknown
    if (!isEnvelope(msg)) return
    if (msg.type === 'saves.set') {
      const v = JSON.parse((msg.payload as { value: string }).value) as { hosted: boolean; waitedMs: number }
      out.game = v
      out.ok = v.hosted === true && v.waitedMs >= readyAt - 50 // the game waited for session.ready
    }
    if (msg.type === 'saves.flush' && msg.kind === 'req') {
      port?.postMessage(makeEnvelope('res', 'saves.flush', { persisted: 'host-outbox' }, msg.id))
      finish()
    }
  }
  iframe.contentWindow?.postMessage(makeEnvelope('evt', 'welcome', baseWelcome(['saves'], {})), gameOrigin, [
    channel.port2,
  ])
  readyAt = 300
  setTimeout(() => port?.postMessage(makeEnvelope('evt', 'session.ready', {})), readyAt)
})
setTimeout(finish, 15_000)
