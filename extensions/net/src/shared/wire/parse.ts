import type { z } from 'zod'
import { type ClientMessage, clientMessageSchema } from './client-message.schema'
import { MAX_MESSAGE_BYTES } from './limits'
import { type ServerMessage, serverMessageSchema } from './server-message.schema'

/**
 * The result of reading a raw message: the message, or why it was refused (too large, not JSON, or
 * not a valid message).
 */
export type ParseResult<M> =
  | { readonly ok: true; readonly message: M }
  | { readonly ok: false; readonly reason: 'too-large' | 'not-json' | 'invalid'; readonly detail: string }

const encoder = new TextEncoder()

/** The size of a text message in UTF-8 bytes, as it travels; a binary message's length. */
const byteLength = (raw: string | Uint8Array): number =>
  typeof raw === 'string' ? encoder.encode(raw).length : raw.length

const decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * The cap comes first: a message past MAX_MESSAGE_BYTES is dropped before `JSON.parse` sees it, so an
 * oversized message costs no parsing. Then JSON, then the strict schema.
 */
function parseWith<S extends z.ZodType>(schema: S, raw: string | Uint8Array): ParseResult<z.output<S>> {
  // Every UTF-16 unit is at least one UTF-8 byte, so a string longer than the cap is past it without encoding it.
  if (typeof raw === 'string' && raw.length > MAX_MESSAGE_BYTES)
    return { ok: false, reason: 'too-large', detail: `over ${MAX_MESSAGE_BYTES} bytes` }
  const bytes = byteLength(raw)
  if (bytes > MAX_MESSAGE_BYTES)
    return { ok: false, reason: 'too-large', detail: `${bytes} bytes, over the cap of ${MAX_MESSAGE_BYTES}` }
  let value: unknown
  try {
    value = JSON.parse(typeof raw === 'string' ? raw : decoder.decode(raw))
  } catch {
    return { ok: false, reason: 'not-json', detail: 'not JSON text' }
  }
  const result = schema.safeParse(value)
  if (!result.success)
    return { ok: false, reason: 'invalid', detail: result.error.issues[0]?.message ?? 'invalid' }
  return { ok: true, message: result.data }
}

/**
 * Reads a raw message from a client. It measures it first, so a message that is too large is
 * refused before it is parsed.
 */
export const parseClientMessage = (raw: string | Uint8Array): ParseResult<ClientMessage> =>
  parseWith(clientMessageSchema, raw)

/** Reads a raw message from the room, the same way. */
export const parseServerMessage = (raw: string | Uint8Array): ParseResult<ServerMessage> =>
  parseWith(serverMessageSchema, raw)
