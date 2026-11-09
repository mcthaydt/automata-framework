/**
 * SvelteKit lists every module a page needs to hydrate as a `<link rel="modulepreload">` in the head: 26 to 29 files,
 * about 250 KB built. On a slow link the stylesheet and the font queue behind them, so the first paint (and the LCP of
 * every page) comes 0.5 to 0.9 s later; the hints help only hydration, which the prerendered text, links and images do
 * not wait for. The hints for the small entry and node modules stay; the shared chunks go. The page still imports the
 * same modules, a little later: the last one arrives about 0.4 s later on a throttled mobile link.
 */
const CHUNK_PRELOAD = /[ \t]*<link\b[^>]*>\n?/g

function isChunkPreload(tag: string): boolean {
  return /\brel="modulepreload"/.test(tag) && /\bhref="[^"]*\/_app\/immutable\/chunks\/[^"]*"/.test(tag)
}

export function withoutChunkPreloads(html: string): string {
  return html.replace(CHUNK_PRELOAD, (tag) => (isChunkPreload(tag) ? '' : tag))
}
