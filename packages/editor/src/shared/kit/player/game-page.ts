import type { RuntimeManifest } from './runtime-manifest'

// A game's `index.html` as the app plays it: the same page, its module scripts pointing at the compiled files and an
// import map in front of them that names where the app's runtime packages are, plus a stylesheet link for each
// stylesheet a script imported.

export interface PageEntries {
  /** The page's `<script type="module" src>` tags, each with its `src` as written. */
  readonly scripts: readonly { readonly tag: string; readonly src: string }[]
  /** The `href` of each `<link rel="stylesheet">` that names a file of the game. */
  readonly localStyles: readonly string[]
}

const attribute = (tag: string, name: string): string | undefined =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
    .exec(tag)
    ?.slice(1)
    .find((v) => v !== undefined)

const isRemote = (url: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)

export function entriesOf(page: string): PageEntries {
  const scripts: { tag: string; src: string }[] = []
  for (const match of page.matchAll(/<script\b[^>]*>\s*<\/script>/gi)) {
    const src = attribute(match[0], 'src')
    if (attribute(match[0], 'type') === 'module' && src !== undefined && !isRemote(src))
      scripts.push({ tag: match[0], src })
  }
  const localStyles: string[] = []
  for (const match of page.matchAll(/<link\b[^>]*>/gi)) {
    const href = attribute(match[0], 'href')
    if (attribute(match[0], 'rel') === 'stylesheet' && href !== undefined && !isRemote(href))
      localStyles.push(href)
  }
  return { scripts, localStyles }
}

/** The page to serve: scripts retargeted to `outputOf(path)`, the import map in the head, the imported styles last. */
export function assemblePage(
  page: string,
  entries: PageEntries,
  runtime: RuntimeManifest,
  styles: readonly string[],
  outputOf: (path: string) => string,
): string {
  let out = page
  for (const { tag, src } of entries.scripts) {
    const kept = src.replace(/^\.?\//, '')
    out = out.replace(tag, tag.replace(src, `./${outputOf(kept)}`))
  }
  const map = {
    imports: Object.fromEntries(Object.entries(runtime.packages).map(([name, entry]) => [name, entry.url])),
  }
  const importMap = `<script type="importmap">${JSON.stringify(map)}</script>`
  out = /<head[^>]*>/i.test(out)
    ? out.replace(/<head[^>]*>/i, (open) => `${open}\n${importMap}`)
    : `${importMap}\n${out}`
  if (styles.length > 0) {
    const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n')
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${links}\n</head>`) : `${links}\n${out}`
  }
  return out
}
