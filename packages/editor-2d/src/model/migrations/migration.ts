// Upgrading a file from an older `version` (2D editor spec §6.1). Each step is a pure function over the parsed JSON
// that moves it from one version to the next; the chain runs in memory when a file is opened and the file changes only
// when it is saved. A step's fixtures are a before and an after file kept beside it, so a migration is reviewed by
// diff. The list is empty at version 1: the mechanism is tested with injected steps.

/** The file version this editor reads and writes. */
export const FILE_VERSION = 1

export type RawFile = Readonly<Record<string, unknown>>

export interface Migration {
  readonly from: number
  /** Always `from + 1`: a step upgrades by one version, so a gap in the list is visible. */
  readonly to: number
  /** Pure: returns the upgraded file and leaves its input as it was. `version` is stamped by `migrate`. */
  readonly run: (raw: RawFile) => RawFile
}

/** The steps from every older version to `FILE_VERSION`. */
export const MIGRATIONS: readonly Migration[] = []

export type MigrateResult =
  | { readonly ok: true; readonly raw: RawFile }
  | { readonly ok: false; readonly message: string }

/** A malformed chain is a bug in the editor, not in a file, so it throws. */
function stepsByVersion(chain: readonly Migration[]): Map<number, Migration> {
  const steps = new Map<number, Migration>()
  for (const step of chain) {
    if (step.to !== step.from + 1) {
      throw new Error(`the migration from version ${step.from} to ${step.to} does not advance by one`)
    }
    if (steps.has(step.from)) throw new Error(`more than one migration from version ${step.from}`)
    steps.set(step.from, step)
  }
  return steps
}

/** Upgrades `raw` from version `from` to `to`, or says which version has no step or whose step threw. */
export function migrate(raw: RawFile, from: number, to: number, chain: readonly Migration[]): MigrateResult {
  const steps = stepsByVersion(chain)
  let current = raw
  for (let version = from; version < to; version++) {
    const step = steps.get(version)
    if (step === undefined) return { ok: false, message: `there is no migration from version ${version}` }
    try {
      current = { ...step.run(current), version: step.to }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return { ok: false, message: `the migration from version ${version} failed: ${reason}` }
    }
  }
  return { ok: true, raw: current }
}
