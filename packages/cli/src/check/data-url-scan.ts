import { globalName, isNode, type Node, parseBundle, stringValue, unwrap } from './bundle-ast.ts'
import type { CheckFinding } from './check-report.ts'

// The `data-urls` scan (DX.5a): finds the assets Vite inlined as `data:` URLs in a built bundle. Vite inlines any
// asset under `build.assetsInlineLimit` (4 kB by default), and for `new URL('./sheet.png', import.meta.url)` it
// writes `new URL("data:image/png;base64,…", "" + import.meta.url)`. Pixi's loader fetches such a URL, and Ruken's
// CSP has no `data:` in `connect-src` or `media-src` (only `img-src` and `font-src` allow it), so the asset never
// loads. Fixed by `build.assetsInlineLimit: 0`, which the content Vite plugin and the create-game template set.
//
// What it does not report: any other `data:` string. Pixi carries its own `data:` probes (detectAvif, detectWebp,
// detectVideoAlphaMode), and an asset imported as `import url from './a.png'` becomes a bare string that cannot be
// told apart from them, so only the `new URL(…, import.meta.url)` form, AF's way of loading an asset, is a finding.

/** The MIME type of a `data:` URL: the text before its first `;` or `,` (`text/plain` when empty, per RFC 2397). */
function mimeOf(url: string): string {
  const mime = /^data:([^;,]*)/i.exec(url)?.[1] ?? ''
  return mime === '' ? 'text/plain' : mime.toLowerCase()
}

/** Whether `node`'s subtree reads `import.meta.url` (Vite writes it as `"" + import.meta.url`). */
function readsImportMetaUrl(node: Node): boolean {
  if (node.type === 'MemberExpression') {
    const object = node.object as Node
    const property = node.property as Node
    if (object.type === 'MetaProperty' && !node.computed && property.name === 'url') return true
  }
  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) {
      if (child.some((item) => isNode(item) && readsImportMetaUrl(item))) return true
    } else if (isNode(child) && readsImportMetaUrl(child)) return true
  }
  return false
}

/** The `data:` URL of a `new URL(<data: literal>, <…import.meta.url…>)`, or undefined for any other node. */
function inlinedAssetUrl(node: Node): string | undefined {
  if (node.type !== 'NewExpression' || globalName(node.callee as Node) !== 'URL') return undefined
  const [url, base] = node.arguments as Node[]
  if (url === undefined || base === undefined || !readsImportMetaUrl(base)) return undefined
  const value = stringValue(unwrap(url))
  return value !== undefined && /^data:/i.test(value) ? value : undefined
}

export function scanForDataUrls(file: string, code: string): CheckFinding[] {
  const parsed = parseBundle(file, code)
  if ('parseError' in parsed) return [parsed.parseError]

  const findings: CheckFinding[] = []
  const visit = (node: Node): void => {
    const url = inlinedAssetUrl(node)
    if (url !== undefined) {
      findings.push({
        file,
        ...parsed.at(node.start),
        rule: 'data-url',
        message:
          `an asset Vite inlined as a data: URL (${mimeOf(url)}) for new URL(…, import.meta.url): Ruken's CSP has ` +
          'no data: in connect-src or media-src, so fetching or playing it is refused. Set ' +
          'build.assetsInlineLimit: 0 in vite.config.ts so it ships as a file',
      })
    }
    for (const key of Object.keys(node)) {
      const child = node[key]
      if (Array.isArray(child)) {
        for (const item of child) if (isNode(item)) visit(item)
      } else if (isNode(child)) visit(child)
    }
  }
  visit(parsed.program)
  return findings.sort((a, b) => a.line - b.line || a.col - b.col)
}
