// The precompiled originals are compiled for the site's origin: an example's `import.meta.url` is
// the literal "<origin>/playground/examples/…". A local server runs them at its own origin, so the literal moves with it.

/** `code` with every quoted `"<from>/playground/` literal starting at `to` instead. */
export function atOrigin(code: string, from: string, to: string): string {
  for (const origin of [from, to])
    if (new URL(origin).origin !== origin) throw new Error(`${origin} is not an origin`)
  return code.replaceAll(`"${from}/playground/`, `"${to}/playground/`)
}
