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
