import { RukenError } from './protocol'

// P01 §7 Rules / Saves: string values; 1 MB per key (UTF-8 bytes), 10 MB per game, <= 256 keys; key regex.
export const KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/
export const MAX_VALUE_BYTES = 1_048_576
export const MAX_TOTAL_BYTES = 10 * 1_048_576 // counts key + value bytes (counting rule is on the P01 gap list)
export const MAX_KEYS = 256

const utf8 = (s: string) => new TextEncoder().encode(s).length

/** Backing store for the Storage-like facade: a Map (hosted cache) or prefixed localStorage (standalone). */
export type Backing = {
  get(k: string): string | null
  set(k: string, v: string): void
  delete(k: string): void
  keys(): string[] // sorted, so key(i) is stable
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'clear' | 'length'>

/** Storage semantics + P01 limits. `onWrite` fires after a successful local write (hosted: emit saves.set/remove). */
export function createStorage(
  backing: Backing,
  onWrite: (op: { kind: 'set'; key: string; value: string } | { kind: 'remove'; key: string }) => void,
  guard: () => void = () => {},
): StorageLike {
  const total = () => backing.keys().reduce((n, k) => n + utf8(k) + utf8(backing.get(k) ?? ''), 0)
  return {
    getItem: (k) => backing.get(k),
    setItem(k, v) {
      guard()
      const value = String(v)
      if (!KEY_RE.test(k)) throw new RukenError('QUOTA_EXCEEDED', `invalid key "${k}"`)
      if (utf8(value) > MAX_VALUE_BYTES)
        throw new RukenError('QUOTA_EXCEEDED', `value for "${k}" exceeds 1 MB`)
      const existing = backing.get(k)
      if (existing === null && backing.keys().length >= MAX_KEYS)
        throw new RukenError('QUOTA_EXCEEDED', 'more than 256 keys')
      const after = total() - (existing === null ? 0 : utf8(k) + utf8(existing)) + utf8(k) + utf8(value)
      if (after > MAX_TOTAL_BYTES) throw new RukenError('QUOTA_EXCEEDED', 'game saves exceed 10 MB')
      backing.set(k, value)
      onWrite({ kind: 'set', key: k, value })
    },
    removeItem(k) {
      guard()
      if (backing.get(k) === null) return
      backing.delete(k)
      onWrite({ kind: 'remove', key: k })
    },
    key: (i) => backing.keys()[i] ?? null,
    clear() {
      guard()
      for (const k of backing.keys()) {
        backing.delete(k)
        onWrite({ kind: 'remove', key: k })
      }
    },
    get length() {
      return backing.keys().length
    },
  }
}
