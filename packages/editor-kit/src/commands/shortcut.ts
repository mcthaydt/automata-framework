/** A parsed shortcut: one key and the modifiers that must be held with it, no others. */
export interface Shortcut {
  /** Lowercased; `' '` for Space and `'+'` for Plus. Compared with `KeyboardEvent.key` lowercased. */
  readonly key: string
  /** Meta on Apple platforms and Ctrl elsewhere: how editors write "the command key". */
  readonly mod: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
  readonly alt: boolean
}

const MODIFIERS = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const
type Modifier = (typeof MODIFIERS)[number]

const KEY_ALIASES: Readonly<Record<string, string>> = { space: ' ', plus: '+' }

function invalid(text: string, why: string): Error {
  return new Error(`invalid shortcut "${text}": ${why}`)
}

/**
 * Reads `Mod+Shift+Z`, `Delete`, `Space`. Names ignore case; `Plus` is the plus key, since `+` separates.
 * Throws on an empty part, a repeated or unknown modifier, no key, or two keys.
 */
export function parseShortcut(text: string): Shortcut {
  const held = new Set<Modifier>()
  let key: string | undefined
  for (const part of text.split('+').map((each) => each.trim().toLowerCase())) {
    if (part === '') throw invalid(text, 'empty part')
    if ((MODIFIERS as readonly string[]).includes(part)) {
      const modifier = part as Modifier
      if (held.has(modifier)) throw invalid(text, `${part} twice`)
      held.add(modifier)
    } else if (key !== undefined) {
      throw invalid(text, 'two keys')
    } else if (part.length > 1 && /^(hyper|super|cmd|command|option|opt|control)$/.test(part)) {
      throw invalid(text, `unknown modifier ${part}`)
    } else {
      key = KEY_ALIASES[part] ?? part
    }
  }
  if (key === undefined) throw invalid(text, 'no key')
  return {
    key,
    mod: held.has('mod'),
    ctrl: held.has('ctrl'),
    meta: held.has('meta'),
    shift: held.has('shift'),
    alt: held.has('alt'),
  }
}

const KEY_NAMES: Readonly<Record<string, string>> = { ' ': 'Space', '+': 'Plus' }

function keyName(key: string): string {
  return KEY_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/** `shift+mod+z` and `Mod+Shift+Z` normalize to the same text, so a conflict is found however it is written. */
export function normalizeShortcut(text: string): string {
  const parsed = parseShortcut(text)
  const parts: string[] = []
  if (parsed.mod) parts.push('Mod')
  if (parsed.ctrl) parts.push('Ctrl')
  if (parsed.meta) parts.push('Meta')
  if (parsed.alt) parts.push('Alt')
  if (parsed.shift) parts.push('Shift')
  parts.push(keyName(parsed.key))
  return parts.join('+')
}
