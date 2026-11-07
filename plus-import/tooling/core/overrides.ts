// The core overrides in pnpm-workspace.yaml (PRODUCT.5, P5-D1). Until core is on a registry, Plus installs each core
// package from the folder the framework's core-packs tool unpacked it into, and pnpm's `overrides` stand in for the
// registry. The format of packs.json belongs to that tool (`PackManifest` in the framework's
// tooling/core-packs/src/pack.ts); this file reads the fields Plus uses and refuses anything else, because the
// names and folders end up in pnpm-workspace.yaml and in paths pnpm installs from.

export const BEGIN = '# core-overrides:begin'
export const END = '# core-overrides:end'

export interface CorePack {
  readonly name: string
  readonly version: string
  /** The tarball's file name in .core/packs. */
  readonly file: string
  readonly sha256: string
  /** The folder in .core/packs that holds the unpacked tarball: what Plus installs. */
  readonly dir: string
}

export interface CorePacks {
  /** The framework commit the packs were built from. */
  readonly sourceCommit: string
  readonly packs: readonly CorePack[]
}

/** A clean build only: the framework's packer writes `<commit>+dirty` for a tree with uncommitted changes. */
const COMMIT = /^[0-9a-f]{40}$/
/** A scoped npm name; the framework publishes every package under a scope. */
const NAME = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const FILE = /^[a-z0-9][a-z0-9._-]*\.tgz$/
const SHA256 = /^[0-9a-f]{64}$/
/** One folder name, starting with a letter or digit: never `.`, `..`, a hidden folder or a path. */
const FOLDER = /^[a-z0-9][a-z0-9._-]*$/

const FIELDS = { name: NAME, version: VERSION, file: FILE, sha256: SHA256, dir: FOLDER } as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parsePack(value: unknown, index: number): CorePack {
  if (!isRecord(value)) throw new Error(`packs.json pack ${index} is not an object`)
  for (const [field, pattern] of Object.entries(FIELDS)) {
    const found = value[field]
    if (typeof found !== 'string' || !pattern.test(found))
      throw new Error(`packs.json pack ${index} has a bad ${field}: ${JSON.stringify(found)}`)
  }
  const { name, version, file, sha256, dir } = value as Record<keyof typeof FIELDS, string>
  return { name, version, file, sha256, dir }
}

/** Reads packs.json, as the framework's `pnpm packs --unpack` writes it, and checks every field Plus uses. */
export function parsePacks(json: string): CorePacks {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('packs.json is not JSON')
  }
  if (!isRecord(value)) throw new Error('packs.json must be an object with sourceCommit and packs')
  const { sourceCommit } = value
  if (typeof sourceCommit !== 'string' || !COMMIT.test(sourceCommit))
    throw new Error(
      `packs.json sourceCommit must be one clean commit (40 lower-case hex characters); found ${JSON.stringify(sourceCommit)}`,
    )
  if (!Array.isArray(value.packs) || value.packs.length === 0) throw new Error('packs.json lists no packs')
  const packs = value.packs.map(parsePack)
  const names = new Set<string>()
  const folders = new Map<string, string>()
  for (const pack of packs) {
    if (names.has(pack.name)) throw new Error(`packs.json lists ${pack.name} twice`)
    names.add(pack.name)
    const other = folders.get(pack.dir)
    if (other !== undefined)
      throw new Error(`packs.json unpacks ${other} and ${pack.name} into one folder, ${pack.dir}`)
    folders.set(pack.dir, pack.name)
  }
  return { sourceCommit, packs }
}

/** The index of the one line that is exactly `marker`. */
function markerLine(lines: readonly string[], marker: string): number {
  const found = lines.flatMap((line, index) => (line === marker ? [index] : []))
  if (found.length === 0) throw new Error(`pnpm-workspace.yaml has no "${marker}" line`)
  if (found.length > 1)
    throw new Error(`pnpm-workspace.yaml has ${found.length} "${marker}" lines; it needs exactly one`)
  return found[0] as number
}

/** Where the block is: the begin and end marker lines. Throws, saying what is wrong, when there is no one block. */
export function blockLines(yaml: string): { readonly begin: number; readonly end: number } {
  const lines = yaml.split('\n')
  const begin = markerLine(lines, BEGIN)
  const end = markerLine(lines, END)
  if (end < begin) throw new Error(`pnpm-workspace.yaml has "${END}" before "${BEGIN}"`)
  return { begin, end }
}

/**
 * Replaces the block between the markers with one `file:` override per pack, sorted by code point so every
 * machine writes the same bytes. A name in `own` is a package Plus has itself in packages/ and is never overridden.
 */
export function writeOverrides(yaml: string, packs: CorePacks, own: ReadonlySet<string>): string {
  const { begin, end } = blockLines(yaml)
  const entries = packs.packs
    .filter((pack) => !own.has(pack.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((pack) => `  '${pack.name}': file:.core/packs/${pack.dir}`)
  const block = [
    BEGIN,
    `# Written by \`pnpm core:sync\` from .core/packs/packs.json (framework commit ${packs.sourceCommit}).`,
    ...(entries.length === 0 ? ['overrides: {}'] : ['overrides:', ...entries]),
    END,
  ]
  const lines = yaml.split('\n')
  return [...lines.slice(0, begin), ...block, ...lines.slice(end + 1)].join('\n')
}
