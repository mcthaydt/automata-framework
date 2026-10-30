// Reading a file into a level (ED3D spec §5.3 flow 1, §11). Opening is the one step where anything can be wrong with
// a file, so the answer is a value the views show, never a throw: the level opens with the profile the registry picks,
// or the person is told which of the other things is the case. A file the registry does not recognise, and one its
// profile refuses (a newer major `format` among them), carry the profiles this editor has, so the message can name them.
import type { ParseIssue } from '../profile/file-codec'
import type { LevelProfile } from '../profile/level-profile'
import { detectProfile, profiles } from '../profile/registry'

/** The largest file the editor opens: the kit's limit for one document (16 MB). */
export const MAX_FILE_BYTES: number = 16 * 1024 * 1024

export type ReadOutcome =
  | {
      readonly status: 'parsed'
      readonly profile: LevelProfile<unknown>
      readonly value: unknown
      readonly text: string
      /** What the file opens with: a newer minor version. Empty for most files. */
      readonly warnings: readonly ParseIssue[]
    }
  | {
      readonly status: 'unrecognised'
      /** The registry's sentence: what the file is not, or where it stops being JSON. */
      readonly reason: string
      readonly installed: readonly string[]
      /** The reason and the installed profiles, as one sentence for the person. */
      readonly message: string
      readonly text: string
    }
  /** The profile refused the file: the issues carry JSON paths; a newer major `format` is one at `format`. */
  | {
      readonly status: 'invalid'
      readonly profile: LevelProfile<unknown>
      readonly issues: readonly ParseIssue[]
      readonly installed: readonly string[]
      readonly text: string
    }
  | { readonly status: 'notText' }
  | { readonly status: 'tooLarge'; readonly bytes: number }

/** The ids of the profiles this editor opens, in the order detection tries them. */
export const installedProfiles = (): readonly string[] => profiles().map((profile) => profile.id)

export type Decoded =
  | { readonly status: 'text'; readonly text: string }
  | { readonly status: 'notText' }
  | { readonly status: 'tooLarge'; readonly bytes: number }

/** The bytes as UTF-8 text. A character is at least a byte, so the size is judged first, before anything is decoded. */
export function decodeText(bytes: Uint8Array): Decoded {
  if (bytes.byteLength > MAX_FILE_BYTES) return { status: 'tooLarge', bytes: bytes.byteLength }
  try {
    return { status: 'text', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { status: 'notText' }
  }
}

/** Decodes the bytes and parses them with the profile the registry picks. */
export function readLevel(bytes: Uint8Array): ReadOutcome {
  const decoded = decodeText(bytes)
  if (decoded.status !== 'text') return decoded
  const { text } = decoded
  const installed = installedProfiles()
  const detected = detectProfile(text)
  if ('reason' in detected) {
    const message = `${detected.reason}. Installed profiles: ${installed.join(', ')}.`
    return { status: 'unrecognised', reason: detected.reason, installed, message, text }
  }
  const { profile } = detected
  const parsed = profile.parse(text)
  if (!parsed.ok) return { status: 'invalid', profile, issues: parsed.issues, installed, text }
  return { status: 'parsed', profile, value: parsed.value, text, warnings: parsed.warnings ?? [] }
}
