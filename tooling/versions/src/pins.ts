// Version pins (ported from Ruken `tooling/versions/pins.ts`, RukenApp b30d31b). Every external dependency
// is pinned to an exact version and recorded in docs/versions.md, so AF and Ruken can be compared line by line.

export interface Pin {
  readonly name: string
  readonly version: string
}

/** The parts of a package.json this check reads. */
export interface Manifest {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly private?: boolean
  readonly publishConfig?: unknown
}

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

/** `workspace:` points inside this repo and `file:` at a vendored tarball; neither is an npm version. */
function isLocal(version: string): boolean {
  return version.startsWith('workspace:') || version.startsWith('file:')
}

/** Every external `name@version` across the manifests, once each, sorted. */
export function pinsFromManifests(manifests: readonly Manifest[]): Pin[] {
  const pins = new Map<string, Pin>()
  for (const manifest of manifests) {
    for (const section of SECTIONS) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        if (!isLocal(version)) pins.set(`${name}@${version}`, { name, version })
      }
    }
  }
  return [...pins.values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
}

/** Rows of the "## npm packages" table: | `name` | version | date | why | */
export function pinsFromVersionsDoc(markdown: string): Pin[] {
  const section = markdown.split(/^## /m).find((part) => part.startsWith('npm packages'))
  if (section === undefined) return []
  const pins: Pin[] = []
  for (const line of section.split('\n')) {
    const match = /^\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|/.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) pins.push({ name: match[1], version: match[2] })
  }
  return pins
}

/** An exact semver: digits, dots and an optional pre-release or build suffix. Anything else is a range. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

/** The pins that are ranges (`^1`, `~1`, `*`, `>=1`, `1.x`) rather than exact versions. */
export function findRanges(pins: readonly Pin[]): Pin[] {
  return pins.filter((pin) => !EXACT_VERSION.test(pin.version))
}

/** `^1.2.3` on an exact version, and nothing looser. */
const CARET_ON_EXACT = /^\^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/

/**
 * The one place a range is allowed: a published package's peerDependencies. An exact peer makes a game on the
 * next patch of Svelte or Vite fail to install AF under npm or strict pnpm, so a published package declares
 * `^<workspace pin>` there. This reads each such peer as its floor (`^5.57.1` → `5.57.1`), which then has to be a
 * recorded pin like any other; every other range, and every peer of a private package, is left for findRanges.
 */
export function publishedPeerFloors(manifest: Manifest): Manifest {
  if (manifest.private === true || manifest.publishConfig === undefined) return manifest
  const peers = Object.entries(manifest.peerDependencies ?? {}).map(([name, version]) => {
    const floor = CARET_ON_EXACT.exec(version)?.[1]
    return [name, floor ?? version] as const
  })
  return { ...manifest, peerDependencies: Object.fromEntries(peers) }
}

/**
 * The exact pins `create-game` writes into a new game's package.json, read from its source: `'name': 'x.y.z'` or
 * `name: 'x.y.z'` in an object, or `deps['name'] = 'x.y.z'`. A scaffold-only pin (a game's Tauri CLI) is used by
 * every game it creates, though no workspace package installs it.
 */
export function pinsFromScaffoldSource(source: string): Pin[] {
  const pin = /(?:'(@?[\w./-]+)'|\b([a-z][\w.-]*))\]?\s*[:=]\s*'(\d+\.\d+\.\d+)'/g
  return [...source.matchAll(pin)].map((match) => ({
    name: (match[1] ?? match[2]) as string,
    version: match[3] as string,
  }))
}
