import { MAX_FILE_CHARS } from '../model/open-project'
import type { ParseError, Profile, ProfileRegistry } from '../profiles/profile'

// Reading a file. Opening a file is the one step where anything can be wrong with it, so the
// result is a value the views can show, never a throw: either the file opens with a profile, or the person is told
// which of the other five things is the case. Nothing here knows a profile by name.

export type ReadOutcome =
  | {
      readonly status: 'parsed'
      readonly profile: Profile<unknown>
      readonly value: unknown
      readonly text: string
    }
  /** Two or more profiles claim the file: the person picks, and the app reads it again with `as`. */
  | { readonly status: 'choose'; readonly candidates: readonly Profile<unknown>[]; readonly text: string }
  /** No profile claims it; the text is for a read-only view. */
  | { readonly status: 'unrecognised'; readonly text: string }
  /** A profile claims it and cannot parse it: the error panel and a read-only view of the text. */
  | {
      readonly status: 'invalid'
      readonly profile: Profile<unknown>
      readonly errors: readonly ParseError[]
      readonly text: string
    }
  | { readonly status: 'notText' }
  | { readonly status: 'tooLarge'; readonly bytes: number }

/**
 * Decodes `bytes` as UTF-8 and parses it with the profile that claims `fileName` and the text. `as` is the id of the
 * profile the person chose after a `choose`: only a profile of that id that also claims the file is used.
 *
 * The size limit is the model's (16 MB). A character is at least a byte, so a file over the limit in bytes
 * is refused here, before it is decoded, and the profile's own check still judges a file that is over it in characters.
 */
export function readDocument(
  registry: ProfileRegistry,
  fileName: string,
  bytes: Uint8Array,
  as?: string,
): ReadOutcome {
  if (bytes.byteLength > MAX_FILE_CHARS) return { status: 'tooLarge', bytes: bytes.byteLength }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { status: 'notText' }
  }
  const claimants = registry.sniff(fileName, text).filter((profile) => as === undefined || profile.id === as)
  const [profile, second] = claimants
  if (profile === undefined) return { status: 'unrecognised', text }
  if (second !== undefined) return { status: 'choose', candidates: claimants, text }
  const parsed = profile.parse(text)
  return parsed.ok
    ? { status: 'parsed', profile, value: parsed.value, text }
    : { status: 'invalid', profile, errors: parsed.error, text }
}
