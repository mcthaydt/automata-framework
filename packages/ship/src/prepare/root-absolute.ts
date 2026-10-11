// Ported from FloorFifty `deploy/tools/root-absolute.ts` (SNEKPRTY/FloorFifty 122a220).
//
// Finds the places a built client names one of its own files by a root-absolute path (`/fonts/x.woff2`,
// `url("/assets/y.png")`). Inside Ruken the game is served from `https://<game-origin>/b/<buildId>/`, and on
// the dev host from `/builds/<buildId>/`, not from the root of its origin, so a root-absolute path is a 404.
// Ruken's own build checks do not look for this, so it is the one check ship adds.
//
// It looks for what is certainly a mistake and nothing else: a path in a script that starts with one of the
// build's own top-level names (`/fonts/`, `/assets/` ...), any root-absolute `url()` or `@import` in a
// stylesheet, and a root-absolute `src`, `href`, `poster` or `action` in a page. A bare `"/"`, a server path
// like `"/health"` and a protocol-relative `//host` are not the build's files.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export interface RootAbsoluteReferenceFound {
  /** The file, relative to the build, with forward slashes. */
  readonly file: string
  /** The text that names the path, as written. */
  readonly reference: string
}

const SCANNED = /\.(?:html|css|js|mjs|webmanifest)$/

const escapeForRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

export function findRootAbsoluteReferences(distDir: string): RootAbsoluteReferenceFound[] {
  // The build's own top-level names: what a root-absolute path would be aiming at.
  const own = readdirSync(distDir).map(escapeForRegExp)
  const inScript = new RegExp(`(["'\`])/(?:${own.join('|')})(?:/[^"'\`\\s]*)?\\1`, 'g')
  const inStyle = /url\(\s*(["']?)\/(?!\/)[^)"']*\1\s*\)|@import\s+(["'])\/(?!\/)[^"']*\2/g
  const inPage = /\b(?:src|href|poster|action)\s*=\s*(["'])\/(?!\/)[^"']*\1/g

  const found: RootAbsoluteReferenceFound[] = []
  for (const path of walk(distDir)) {
    if (!SCANNED.test(path)) continue
    const text = readFileSync(path, 'utf8')
    const patterns = path.endsWith('.css')
      ? [inStyle]
      : path.endsWith('.html')
        ? [inPage, inStyle]
        : [inScript]
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        found.push({ file: relative(distDir, path).split(sep).join('/'), reference: match[0] })
      }
    }
  }
  return found
}
