import type { IdSource } from '../model/ids'

// What a document type plugs into the editor (2D editor spec §7). The editor lists the documents of every registered
// profile on Home, opens one with the profile that `sniff`s it (and asks when two do), shows the profile's views on the
// rail and runs its checks. `level-project` is built in (ED2D.3); `floorfifty-stage` is an extension (EDFF.1).
//
// The members that take a value are declared as methods, which TypeScript checks bivariantly, so a `Profile<Stage>` is
// a `Profile<unknown>` and registers without a cast. The registry never calls them: the app pairs a profile's own
// `parse` with its own `print`.

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

/** Why a text did not parse, with the position when the profile knows it (from 1). */
export interface ParseError {
  readonly code: string
  readonly message: string
  readonly path?: string | undefined
  readonly line?: number | undefined
  readonly column?: number | undefined
}

export type Severity = 'error' | 'warning' | 'info'

/** One finding of a profile's checks. `path` addresses the object (`levels[moss-steps].layers[entities].items[q8m2c7d1]`). */
export interface Diagnostic {
  readonly severity: Severity
  readonly code: string
  readonly path: string
  readonly message: string
  /** The name of a one-step repair the profile offers for this finding (`remove`, `move-inside`). */
  readonly fix?: string | undefined
}

/** What a profile's checks may know beyond the document. */
export interface ProjectContext {
  /** Asset paths in the workspace, so a check can tell a missing image from a present one. */
  readonly assets?: readonly string[] | undefined
}

/** A rail destination. The component is named, and `app/` maps the name to a Svelte component. */
export interface ViewDef {
  readonly id: string
  readonly label: string
  readonly component: string
}

export interface ExportTarget<V> {
  readonly id: string
  readonly label: string
  files(value: V): readonly { readonly path: string; readonly contents: string }[]
}

export interface TemplateDef<V> {
  readonly id: string
  readonly label: string
  /** Ids of everything the template places come from `ids`, so tests are exact. */
  create(ids: IdSource): V
}

export interface Profile<V> {
  /** `level-project`, `floorfifty-stage`. */
  readonly id: string
  readonly label: string
  /** Can this profile open the file? */
  sniff(fileName: string, text: string): boolean
  /** A position for every error. */
  parse(text: string): Result<V, readonly ParseError[]>
  /** `base` is the text as loaded, which a codec may patch instead of reprinting. */
  print(base: string, value: V): string
  check(value: V, context: ProjectContext): readonly Diagnostic[]
  readonly templates: readonly TemplateDef<V>[]
  readonly views: readonly ViewDef[]
  readonly exports: readonly ExportTarget<V>[]
}

export interface ProfileRegistry {
  /** Throws when the id is taken. Returns the function that removes this registration. */
  register(profile: Profile<unknown>): () => void
  /** In registration order; a snapshot. */
  list(): readonly Profile<unknown>[]
  get(id: string): Profile<unknown> | undefined
  /** Every profile that claims the file, in registration order; the app asks when there are two. */
  sniff(fileName: string, text: string): readonly Profile<unknown>[]
}

export function createProfileRegistry(): ProfileRegistry {
  // A Map keeps insertion order, which is the registration order.
  const profiles = new Map<string, Profile<unknown>>()
  return {
    register(profile) {
      if (profiles.has(profile.id))
        throw new Error(`a profile with the id "${profile.id}" is already registered`)
      profiles.set(profile.id, profile)
      return () => {
        // Only this registration: the id may since have been registered again.
        if (profiles.get(profile.id) === profile) profiles.delete(profile.id)
      }
    },
    list: () => [...profiles.values()],
    get: (id) => profiles.get(id),
    sniff: (fileName, text) => [...profiles.values()].filter((profile) => profile.sniff(fileName, text)),
  }
}
