// The words `net` puts on screen as locale keys with an English catalog. Core gives an extension's
// components no message catalog, so `net`'s UI reads text through `netText(key, params, catalog)`: the game passes a catalog
// built from its locale files (the same keys), and the English one below is the default and the source of the keys.
// Each error message names the cause and the next action. `{name}` marks a value filled in at run time.
import type { NetErrorCode } from '@automata/net'

export type NetCopyKey = `net.${string}`

export const NET_COPY_EN: Readonly<Record<NetCopyKey, string>> = {
  'net.badge.connecting': 'Connecting…',
  'net.badge.connected': 'Online',
  'net.badge.reconnecting': 'Reconnecting… {seconds} s',
  'net.badge.degraded': 'Poor connection',
  'net.reconnect.title': 'Connection lost',
  'net.reconnect.countdown': 'Trying to get you back in. {seconds} s left.',
  'net.reconnect.expired': 'Could not reconnect. Check your connection, then leave and join again.',
  'net.reconnect.leave': 'Leave',
  'net.error.REFUSED': 'The room refused you. Try another room.',
  'net.error.VERSION_MISMATCH':
    'This room runs a different version. Reload the page to update, then try again.',
  'net.error.ROOM_NOT_FOUND': 'That room does not exist any more. Check the code and try again.',
  'net.error.ROOM_FULL': 'That room is full or has started. Try another room.',
  'net.error.SERVER_BUSY': 'The server is busy. Wait a moment, then try again.',
  'net.error.SERVER_UPDATING': 'The server is updating. Wait a few minutes, then try again.',
  'net.error.RATE_LIMITED': 'Too many tries. Wait a moment, then try again.',
  'net.error.UNVERIFIED': 'We could not confirm who you are. Reload the page, then try again.',
  'net.error.OFFLINE': 'You are offline. Check your connection, then try again.',
}

/** Every key, sorted: what a locale file must supply. */
export const netCopyKeys = (): string[] => Object.keys(NET_COPY_EN).sort()

/** The key for a `NetError` code's message. */
export const netErrorKey = (code: NetErrorCode): NetCopyKey => `net.error.${code}`

/** The text for `key`, with `{name}` placeholders filled from `params`; one with no value is left as written, so a gap shows. */
export function netText(
  key: NetCopyKey,
  params: Readonly<Record<string, string | number>> = {},
  catalog: Readonly<Record<string, string>> = NET_COPY_EN,
): string {
  const text = catalog[key] ?? NET_COPY_EN[key] ?? key
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}
