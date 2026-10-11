// Ported from FloorFifty `deploy/tools/root-absolute.ts` (SNEKPRTY/FloorFifty 122a220), then rewritten to read
// each file's syntax instead of matching its text (audit round 2: a data URI in a srcset, prose in a page and a
// commented-out fetch were all reported).
//
// Finds the places a built client names one of its own files by a root-absolute path (`/fonts/x.woff2`,
// `url("/assets/y.png")`). Inside Ruken the game is served from `https://<game-origin>/b/<buildId>/`, and on
// the dev host from `/builds/<buildId>/`, not from the root of its origin, so a root-absolute path is a 404.
// Ruken's own build checks do not look for this, so it is the one check ship adds.
//
// It looks for what is certainly a mistake and nothing else:
// - scripts (.js, .mjs, .cjs and inline <script>): a string literal, or the start of a template literal, that
//   starts with one of the build's own top-level names (`/fonts/`, `/assets/` ...). Parsed with oxc, so
//   comments are not read;
// - stylesheets (.css, <style>, style=""): any root-absolute `url()`, `@import` or `image-set()` string, with
//   comments removed first;
// - pages (.html): a root-absolute URL attribute (src, href, xlink:href, poster, action, formaction, data),
//   each root-absolute candidate of a srcset or imagesrcset, and a meta content naming one of the build's own
//   files. Only tags are read: text between them and comments are not;
// - JSON (a Pixi spritesheet's `meta.image`, a web app manifest, an import map): a string value that starts
//   with one of the build's own top-level names.
// A bare `"/"` in a script, a server path like `"/health"` and a protocol-relative `//host` are not the
// build's files.

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { parseSync } from 'oxc-parser'

export interface RootAbsoluteReferenceFound {
  /** The file, relative to the build, with forward slashes. */
  readonly file: string
  /** The text that names the path, as written. */
  readonly reference: string
}

const SCRIPT = /\.(?:js|mjs|cjs)$/
const JSON_FILE = /\.(?:json|webmanifest)$/

/** Every file under `dir`, following symlinked folders once each (a link back up would loop forever). */
function walk(dir: string, seen = new Set<string>()): string[] {
  const real = realpathSync(dir)
  if (seen.has(real)) return []
  seen.add(real)
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path, seen) : [path]
  })
}

const isRootAbsolute = (url: string): boolean => url.startsWith('/') && !url.startsWith('//')

export function findRootAbsoluteReferences(distDir: string): RootAbsoluteReferenceFound[] {
  // The build's own top-level names: what a root-absolute path would be aiming at.
  const own = new Set(readdirSync(distDir))
  const namesOwnFile = (text: string): boolean => {
    const match = /^\/([^/\s]+)(?:\/\S*)?$/.exec(text)
    return match?.[1] !== undefined && own.has(match[1])
  }

  const found: RootAbsoluteReferenceFound[] = []
  for (const path of walk(distDir)) {
    const file = relative(distDir, path).split(sep).join('/')
    let references: string[]
    if (path.endsWith('.html')) references = inPage(readFileSync(path, 'utf8'), namesOwnFile)
    else if (path.endsWith('.css')) references = inStyle(readFileSync(path, 'utf8'))
    else if (SCRIPT.test(path)) references = inScript(file, readFileSync(path, 'utf8'), namesOwnFile)
    else if (JSON_FILE.test(path)) references = inJson(readFileSync(path, 'utf8'), namesOwnFile)
    else continue
    for (const reference of references) found.push({ file, reference })
  }
  return found
}

// --- Scripts ---------------------------------------------------------------------------------------------

/**
 * String literals and template literal starts that name one of the build's files. The AST is walked
 * generically (every object property), which reaches every expression without listing node types; comments
 * are not part of the AST.
 */
function inScript(filename: string, code: string, namesOwnFile: (text: string) => boolean): string[] {
  const references: string[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (node === null || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    if (record.type === 'Literal' && typeof record.value === 'string' && namesOwnFile(record.value)) {
      references.push(typeof record.raw === 'string' ? record.raw : JSON.stringify(record.value))
    }
    if (record.type === 'TemplateLiteral') {
      // Only the first piece is the start of the string: in `${base}/assets/x` the path follows a variable.
      const quasis = record.quasis as { value: { cooked: string | null; raw: string } }[]
      const start = quasis[0]?.value.cooked ?? ''
      if (namesOwnFile(start)) references.push(`\`${start}${quasis.length > 1 ? '${...}' : ''}\``)
    }
    for (const value of Object.values(record)) if (typeof value === 'object') visit(value)
  }
  // oxc picks the dialect from the name; an inline script has none, so it is read as an ES module.
  visit(parseSync(SCRIPT.test(filename) ? filename : 'inline.mjs', code).program)
  return references
}

// --- JSON ------------------------------------------------------------------------------------------------

function inJson(text: string, namesOwnFile: (text: string) => boolean): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return [] // not JSON after all; nothing a loader could read a path from
  }
  const references: string[] = []
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (namesOwnFile(value)) references.push(JSON.stringify(value))
    } else if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) visit(child)
    }
  }
  visit(parsed)
  return references
}

// --- Stylesheets -----------------------------------------------------------------------------------------

/** Root-absolute `url()`, `@import` and `image-set()` strings, with comments removed first. */
function inStyle(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const references: string[] = []
  for (const match of text.matchAll(/url\(\s*(["']?)([^)"']*)\1\s*\)|@import\s+(["'])([^"']*)\3/g)) {
    if (isRootAbsolute(match[2] ?? match[4] ?? '')) references.push(match[0])
  }
  // image-set() also takes bare strings (`image-set("/a.png" 1x)`); its url() forms are covered above.
  for (const set of text.matchAll(/image-set\(((?:[^()]|\([^()]*\))*)\)/g)) {
    for (const match of (set[1] ?? '').matchAll(/(?<!url\(\s*)(["'])([^"']*)\1/g)) {
      if (isRootAbsolute(match[2] ?? '')) references.push(match[0])
    }
  }
  return references
}

// --- Pages -----------------------------------------------------------------------------------------------

const URL_ATTRIBUTES = new Set(['src', 'href', 'xlink:href', 'poster', 'action', 'formaction', 'data'])
const SRCSET_ATTRIBUTES = new Set(['srcset', 'imagesrcset'])
// script and style hold raw text up to their closing tag; anything that looks like a tag inside is not one.
const RAW_TEXT = new Set(['script', 'style'])
const JS_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript'])
const JSON_TYPES = new Set(['importmap', 'application/json', 'application/ld+json', 'speculationrules'])

interface Attribute {
  readonly name: string
  readonly value: string
  /** The attribute as written, for the report. */
  readonly written: string
}

function attributesOf(text: string): Attribute[] {
  const attributes: Attribute[] = []
  for (const match of text.matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attributes.push({ name: (match[1] ?? '').toLowerCase(), value, written: match[0] })
  }
  return attributes
}

/**
 * The URLs of a srcset, as the HTML spec splits it: a URL runs to the next whitespace (so a data URI keeps its
 * comma), a URL ending in commas ends its candidate, and otherwise the descriptors run to the next comma
 * outside parentheses.
 */
function srcsetUrls(value: string): string[] {
  const urls: string[] = []
  let at = 0
  while (at < value.length) {
    while (at < value.length && /[\s,]/.test(value[at] ?? '')) at += 1
    if (at >= value.length) break
    const start = at
    while (at < value.length && !/\s/.test(value[at] ?? '')) at += 1
    let url = value.slice(start, at)
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '')
    } else {
      let depth = 0
      while (at < value.length) {
        const character = value[at]
        if (character === '(') depth += 1
        else if (character === ')') depth -= 1
        else if (character === ',' && depth <= 0) break
        at += 1
      }
    }
    urls.push(url)
  }
  return urls
}

/**
 * Reads a page's tags in order, skipping comments and the text between tags. Inline scripts, import maps and
 * styles are handed to the script, JSON and stylesheet readers.
 */
function inPage(html: string, namesOwnFile: (text: string) => boolean): string[] {
  const references: string[] = []
  const tag = /<!--[\s\S]*?(?:-->|$)|<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g
  for (let match = tag.exec(html); match !== null; match = tag.exec(html)) {
    const name = match[1]?.toLowerCase()
    if (name === undefined) continue // a comment
    const attributes = attributesOf(match[2] ?? '')
    for (const attribute of attributes) {
      if (URL_ATTRIBUTES.has(attribute.name) && isRootAbsolute(attribute.value)) {
        references.push(attribute.written)
      } else if (SRCSET_ATTRIBUTES.has(attribute.name)) {
        references.push(...srcsetUrls(attribute.value).filter(isRootAbsolute))
      } else if (attribute.name === 'style') {
        references.push(...inStyle(attribute.value))
      } else if (name === 'meta' && attribute.name === 'content' && namesOwnFile(attribute.value)) {
        references.push(attribute.written)
      }
    }
    if (!RAW_TEXT.has(name)) continue
    const end = html.toLowerCase().indexOf(`</${name}`, tag.lastIndex)
    const body = html.slice(tag.lastIndex, end === -1 ? html.length : end)
    tag.lastIndex = end === -1 ? html.length : end
    if (name === 'style') {
      references.push(...inStyle(body))
      continue
    }
    if (attributes.some((attribute) => attribute.name === 'src')) continue // the body of a src script is ignored
    const type = (attributes.find((attribute) => attribute.name === 'type')?.value ?? '').trim().toLowerCase()
    if (JS_TYPES.has(type)) references.push(...inScript('inline', body, namesOwnFile))
    else if (JSON_TYPES.has(type)) references.push(...inJson(body, namesOwnFile))
  }
  return references
}
