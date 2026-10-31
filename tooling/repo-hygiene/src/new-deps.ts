// The new-dependency report on pull requests (QB spec §4.1, QB.1). It lists every package a branch adds that
// no manifest on the base used, with its registry, and for npmjs.org packages the publisher of that version and
// the weekly downloads, so a reviewer can confirm an agent-added package exists and is the intended one. A
// package or version its registry does not have is "missing", and the CLI fails on it.

export type Fetch = (url: string) => Promise<Response>

export interface Manifest {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
}

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

export interface NewDependency {
  /** The package.json it was added to, relative to the repository root. */
  readonly manifest: string
  readonly section: string
  readonly name: string
  readonly version: string
  readonly registry: string
}

export interface DependencyReport extends NewDependency {
  /** `not checked`: the registry needs a token (GitHub Packages), so the report does not query it. */
  readonly status: 'found' | 'missing' | 'not checked'
  readonly publisher?: string
  readonly weeklyDownloads?: number
}

const NPMJS = 'https://registry.npmjs.org'

/** The registry a dependency installs from, or undefined for a `workspace:` or `file:` version. */
export function registryFor(
  name: string,
  version: string,
  scopes: Readonly<Record<string, string>>,
): string | undefined {
  if (version.startsWith('workspace:') || version.startsWith('file:')) return undefined
  const scope = name.startsWith('@') ? name.slice(0, name.indexOf('/')) : undefined
  return (scope === undefined ? undefined : scopes[scope]) ?? NPMJS
}

/** Every registry dependency in `head` whose name no manifest in `base` uses, in manifest order. */
export function newDependencies(
  base: Readonly<Record<string, Manifest>>,
  head: Readonly<Record<string, Manifest>>,
  scopes: Readonly<Record<string, string>>,
): NewDependency[] {
  const known = new Set(
    Object.values(base).flatMap((manifest) =>
      SECTIONS.flatMap((section) => Object.keys(manifest[section] ?? {})),
    ),
  )
  const found: NewDependency[] = []
  for (const [manifest, contents] of Object.entries(head)) {
    for (const section of SECTIONS) {
      for (const [name, version] of Object.entries(contents[section] ?? {})) {
        const registry = registryFor(name, version, scopes)
        if (registry === undefined || known.has(name)) continue
        found.push({ manifest, section, name, version, registry })
      }
    }
  }
  return found
}

interface Packument {
  readonly versions?: Readonly<Record<string, { readonly _npmUser?: { readonly name?: string } }>>
}

async function describeOne(dependency: NewDependency, fetch: Fetch): Promise<DependencyReport> {
  if (dependency.registry !== NPMJS) return { ...dependency, status: 'not checked' }
  const packument = await fetch(`${NPMJS}/${dependency.name.replace('/', '%2f')}`)
  if (!packument.ok) return { ...dependency, status: 'missing' }
  // A range (`^2.12.4`, `~2.12.4`, a peer dependency's form) is checked by the version it names, its lower bound.
  const named = dependency.version.replace(/^[\^~]/, '')
  const version = ((await packument.json()) as Packument).versions?.[named]
  if (version === undefined) return { ...dependency, status: 'missing' }
  const downloads = await fetch(`https://api.npmjs.org/downloads/point/last-week/${dependency.name}`)
  const weeklyDownloads = downloads.ok
    ? ((await downloads.json()) as { downloads?: number }).downloads
    : undefined
  const publisher = version._npmUser?.name
  return {
    ...dependency,
    status: 'found',
    ...(publisher === undefined ? {} : { publisher }),
    ...(weeklyDownloads === undefined ? {} : { weeklyDownloads }),
  }
}

/** Looks each new dependency up on its registry, one at a time. */
export async function describeDependencies(
  dependencies: readonly NewDependency[],
  fetch: Fetch,
): Promise<DependencyReport[]> {
  const reports: DependencyReport[] = []
  for (const dependency of dependencies) reports.push(await describeOne(dependency, fetch))
  return reports
}

/** The report as Markdown, for the log and the job summary. */
export function formatReport(rows: readonly DependencyReport[], base: string): string {
  const title = `### New dependencies versus ${base}\n\n`
  if (rows.length === 0) return `${title}None.\n`
  const lines = [
    '| Package | Version | Added to | Registry | Publisher | Weekly downloads | Status |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(
      (row) =>
        `| \`${row.name}\` | ${row.version} | ${row.manifest} (${row.section}) | ${row.registry} | ` +
        `${row.publisher ?? '–'} | ${row.weeklyDownloads ?? '–'} | ${row.status} |`,
    ),
  ]
  return `${title}${lines.join('\n')}\n`
}
