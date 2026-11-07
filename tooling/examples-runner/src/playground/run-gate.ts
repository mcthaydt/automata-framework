import { type RunMessage, runMessage } from './playground-protocol.ts'

/** The parts of a `message` event the gate reads. */
export interface IncomingMessage {
  readonly source: unknown
  readonly origin: string
  readonly data: unknown
}

/**
 * Which messages a frame acts on: one `run`, ever, and only from the page that framed
 * it, which is `parentWindow` with the site's origin (the frame's document URL is on the site, though its own origin
 * is opaque). Anything else is dropped, and dropping it leaves the gate open for the real run.
 */
export function createRunGate(
  parentWindow: unknown,
  siteOrigin: string,
): (message: IncomingMessage) => RunMessage | undefined {
  let accepted = false
  return (message) => {
    if (accepted || message.source !== parentWindow || message.origin !== siteOrigin) return undefined
    const parsed = runMessage.safeParse(message.data)
    if (!parsed.success) return undefined
    accepted = true
    return parsed.data
  }
}
