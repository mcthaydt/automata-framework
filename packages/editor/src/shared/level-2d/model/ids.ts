// Ids of instances (entities, objects) are generated, never typed: they stay stable across edits and duplication so
// references survive (2D editor spec §5.1). The source is injected so `model/` holds no randomness and tests are exact.

export interface IdSource {
  next(): string
}

/** The id of a definition or a level, which a person types: kebab-case, starting with a letter (`moss-steps`). */
export const DEF_ID: RegExp = /^[a-z][a-z0-9-]*$/
/** The id of something inside a project that a generator mints (an instance, a rule): lower case, digits, hyphens. */
export const ITEM_ID: RegExp = /^[a-z0-9][a-z0-9-]*$/

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const ID_LENGTH = 8

/** `00000001`, `00000002`, …: the deterministic source for tests and fixtures. */
export function counterIds(start = 1): IdSource {
  let counter = start
  return {
    next: () => (counter++).toString(36).padStart(ID_LENGTH, '0'),
  }
}

/**
 * Eight base36 characters per id from the host's random bytes (`crypto.getRandomValues` in the app). A byte maps to
 * a character by remainder, which is slightly uneven and does not matter: ids only have to avoid colliding inside
 * one project, and `decodeProject` rejects a duplicate.
 */
export function randomIds(fill: (bytes: Uint8Array<ArrayBuffer>) => void): IdSource {
  const bytes = new Uint8Array(ID_LENGTH)
  return {
    next: () => {
      fill(bytes)
      let id = ''
      for (const byte of bytes) id += ALPHABET.charAt(byte % ALPHABET.length)
      return id
    },
  }
}
