// The bins' resolve hook (SB-D6). The bins run on Node's type stripping, and the extensions they load (and a game's
// scene module) import their TypeScript sources without an extension, which Node does not resolve. Below a `.ts`
// module, an extensionless relative or `file:` specifier is tried as `<specifier>.ts`, then `<specifier>/index.ts`,
// then left to Node (so a missing module gives Node's own error). Bare specifiers, specifiers with an extension and
// imports from JavaScript are Node's alone (TR-D1), so published JavaScript resolves exactly as it would without it.
// Node also refuses to strip types under node_modules, where pnpm puts a core package that ships only its sources
// (core's private `sector-format`): the load hook strips those itself, with Node's own stripper (TR-D3). A `?raw`
// import is a file's text as its default export, Vite's convention, which fixtures and scene modules use (TR-D4).
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'

type Context = { readonly parentURL?: string | undefined }
type Resolved = { readonly url: string }
type Next = (specifier: string, context?: Context) => Resolved

const HAS_EXTENSION = /\.(?:[cm]?[jt]s|json)$/
// A path with a query or hash (`?raw`) is left to Node: `<specifier>.ts` would land in the query.
const PATHLIKE = /^(?:\.\.?\/|file:)[^?#]*$/

export function resolveTs<C extends Context, R extends Resolved>(
  specifier: string,
  context: C,
  next: (specifier: string, context?: C) => R,
): R {
  const fromTs = context.parentURL?.endsWith('.ts') === true
  if (fromTs && PATHLIKE.test(specifier) && !HAS_EXTENSION.test(specifier)) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return next(candidate, context)
      } catch {
        // Not this one: try the next, and in the end Node's own resolution (and its error).
      }
    }
  }
  return next(specifier, context)
}

type Loaded = {
  readonly format?: string | null | undefined
  readonly source?: unknown
  readonly shortCircuit?: boolean
}

const UNDER_NODE_MODULES = /^file:.*\/node_modules\/.*\.ts$/

export function loadTs<R extends Loaded>(
  url: string,
  context: object,
  next: (url: string, context?: object) => R,
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): Loaded {
  const raw = url.startsWith('file:') ? new URL(url) : null
  if (raw !== null && raw.search === '?raw') {
    raw.search = ''
    const text = read(fileURLToPath(raw))
    return { format: 'module', source: `export default ${JSON.stringify(text)}\n`, shortCircuit: true }
  }
  if (!UNDER_NODE_MODULES.test(url)) return next(url, context)
  return { format: 'module', source: stripTypeScriptTypes(read(fileURLToPath(url))), shortCircuit: true }
}

/** Registers the hooks for this process; a bin calls it before any stage loads its extension. */
export function registerTsResolve(): void {
  registerHooks({
    resolve: (specifier, context, next) => resolveTs(specifier, context, next as Next) as never,
    load: (url, context, next) => loadTs(url, context, next as (url: string) => Loaded) as never,
  })
}
