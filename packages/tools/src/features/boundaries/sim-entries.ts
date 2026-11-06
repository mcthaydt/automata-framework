import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { z } from 'zod'

// P5-D2: which entries of an installed extension a game's sim may import. The extension says so itself, in its
// own package.json, so core never names a Plus package and a new extension needs no edit here:
//   "automata": { "simEntries": ["./2d", "./3d"] }
// The checker trusts the declaration for the import only. The extension's own sources are checked by its own
// `automata-check-boundaries` run, which is what makes "sim-safe" true.

export type SimEntryVerdict =
  | { readonly allowed: true }
  /** `detail` is set when the package is installed and said something about its entries (or said it wrongly). */
  | { readonly allowed: false; readonly detail?: string }

/** `.` or `./sub/path`: a subpath of the package, never one that leaves it or names a pattern. */
const isSubpath = (value: string): boolean =>
  value === '.' ||
  (value.startsWith('./') &&
    !value.includes('*') &&
    !value.includes('\\') &&
    !value.split('/').includes('..'))

const manifestSchema = z.looseObject({
  automata: z
    .looseObject({
      simEntries: z.array(z.string().refine(isSubpath, 'must be "." or "./subpath"')).optional(),
    })
    .optional(),
})

/** `@scope/name/sub/path` → the package name and the entry key (`./sub/path`, or `.` for the root). */
function splitSpecifier(source: string): { name: string; entry: string } | undefined {
  const parts = source.split('/')
  const nameParts = source.startsWith('@') ? 2 : 1
  const name = parts.slice(0, nameParts)
  if (name.length < nameParts || name.some((part) => part === '' || part === '.' || part === '..'))
    return undefined
  const rest = parts.slice(nameParts)
  return { name: name.join('/'), entry: rest.length === 0 ? '.' : `./${rest.join('/')}` }
}

/** The package.json of `name` as Node would find it from `file`: the nearest node_modules above it that has it. */
function installedManifest(file: string, name: string): string | undefined {
  let dir = dirname(resolve(file))
  for (;;) {
    const candidate = join(dir, 'node_modules', name, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/** Whether a sim file may import `source`, a bare specifier, because the installed package declares it. */
export function simEntryVerdict(file: string, source: string): SimEntryVerdict {
  const target = splitSpecifier(source)
  if (target === undefined) return { allowed: false }
  const manifestPath = installedManifest(file, target.name)
  if (manifestPath === undefined) return { allowed: false }

  let json: unknown
  try {
    json = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return { allowed: false, detail: `${target.name} has a package.json that is not valid JSON` }
  }
  const parsed = manifestSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const why = issue === undefined ? 'unreadable' : `${issue.path.join('.')}: ${issue.message}`
    return { allowed: false, detail: `${target.name} declares automata.simEntries wrongly (${why})` }
  }
  const declared = parsed.data.automata?.simEntries
  if (declared === undefined) return { allowed: false }
  if (declared.includes(target.entry)) return { allowed: true }
  return { allowed: false, detail: `${target.name} declares only ${declared.join(', ')} for a sim` }
}
