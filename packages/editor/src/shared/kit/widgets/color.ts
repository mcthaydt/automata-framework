// Colours as the editors store them: `#rrggbb`. Pure; the kit's `./fields` entry holds the
// same pattern for stored field values, and a widget keeps its own so it stays usable without that entry.

const HEX = /^#[0-9a-fA-F]{6}$/

export type ParsedColor =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string }

/** Typed text is `#rrggbb` in either case (surrounding space is fine); the value comes back lower-cased. */
export function parseHexColor(text: string): ParsedColor {
  const trimmed = text.trim()
  return HEX.test(trimmed)
    ? { ok: true, value: trimmed.toLowerCase() }
    : { ok: false, message: 'Use #rrggbb, for example #e0a54a' }
}

export const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
