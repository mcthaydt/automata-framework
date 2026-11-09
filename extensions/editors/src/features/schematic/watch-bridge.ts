// What the game tells Schematic while it runs: the debug extension, inside the framed game, posts each mode change to
// this page. Only a message from the frame's own window, at the game's own origin, is read; anything else is somebody
// else's and is ignored.

/** A mode change, or the news that the game's debug extension is listening. */
export type WatchEvent =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'mode'
      readonly seconds: number
      readonly agent: string
      readonly from: string
      readonly to: string
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** The message as an event, or `undefined` when it is not one this editor asked for. */
function eventOf(data: unknown): WatchEvent | undefined {
  if (!isRecord(data)) return undefined
  if (data.type === 'af-watch-ready') return { kind: 'ready' }
  if (data.type !== 'af-sim-event' || data.name !== 'systems.mode') return undefined
  const { seconds, payload } = data
  if (typeof seconds !== 'number' || !isRecord(payload)) return undefined
  const { agent, from, to } = payload
  if (typeof agent !== 'string' || typeof from !== 'string' || typeof to !== 'string') return undefined
  return { kind: 'mode', seconds, agent, from, to }
}

/** Listens for the game in `frame`, which is served from `gameOrigin`. Returns the stop. */
export function watchBridge(
  frame: HTMLIFrameElement,
  gameOrigin: string,
  on: (event: WatchEvent) => void,
): () => void {
  const listener = (message: MessageEvent): void => {
    if (message.source !== frame.contentWindow || message.origin !== gameOrigin) return
    const event = eventOf(message.data)
    if (event !== undefined) on(event)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
