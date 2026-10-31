import type { RefValue } from '@mcthaydt/automata-editor-kit/fields'
import type { IdSource } from '../model/ids'
import type { Project } from '../model/project-types'

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

/** One target a broken reference may be pointed at, as the Checks view lists it. */
export interface TargetChoice {
  readonly label: string
  readonly value: RefValue
}

/** What a profile's checks may know beyond the document. */
export interface ProjectContext {
  /** Asset paths in the workspace, so a check can tell a missing image from a present one. */
  readonly assets?: readonly string[] | undefined
  /** The measured size of those images by path, so a check can tell a replaced image from the one that was recorded. */
  readonly imageSizes?: Readonly<Record<string, { readonly w: number; readonly h: number }>> | undefined
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
  /**
   * `base` is the text the document was loaded from, or `''` for one that never was, so a profile whose `print` patches
   * the loaded text exports the file with its comments. A target that prints the whole value ignores it.
   */
  files(value: V, base: string): readonly { readonly path: string; readonly contents: string }[]
}

export interface TemplateDef<V> {
  readonly id: string
  readonly label: string
  /** A few words under the label on the template's card ("side view"). */
  readonly hint?: string | undefined
  /** Ids of everything the template places come from `ids`, so tests are exact. */
  create(ids: IdSource): V
}

/** What Home shows about a document that opens: its own name and a few facts about it, already worded. */
export interface ProfileSummary {
  /** The document's own name (the project's `name`), not its file name. */
  readonly title: string
  /** In the order they are shown: `Levels 5`, `Layers 4`. */
  readonly facts: readonly { readonly label: string; readonly value: string }[]
}

/**
 * The level a Home card draws as the document's thumbnail (ED2D.4c3b): a level of a level project. It names the
 * level-project `Project` type because the card is drawn by the level canvas, which draws nothing else; a profile whose
 * documents are not level projects (the FloorFifty stage) leaves `preview` out until it has a picture of its own.
 */
export interface LevelPreview {
  readonly project: Project
  /** A level id of `project`. */
  readonly level: string
}

export interface Profile<V> {
  /** `level-project`, `floorfifty-stage`. */
  readonly id: string
  readonly label: string
  /** Can this profile open the file? */
  sniff(fileName: string, text: string): boolean
  /** A position for every error. */
  parse(text: string): Result<V, readonly ParseError[]>
  /** `base` is the text as loaded, which a codec may patch instead of reprinting; `''` for a document that never was loaded. */
  print(base: string, value: V): string
  check(value: V, context: ProjectContext): readonly Diagnostic[]
  /**
   * Applies the one-step repair a finding's `fix` names and returns the next value. The app offers it for a finding of
   * the value it came from; absent when the profile offers no repair.
   */
  fix?(value: V, diagnostic: Diagnostic, context: ProjectContext): V
  /** The targets a `choose-target` finding may point at, which `fix` cannot take (plan ED2D.7a decision 3). */
  choices?(value: V, diagnostic: Diagnostic): readonly TargetChoice[]
  /** Points the finding's reference at `choice` and returns the next value. */
  choose?(value: V, diagnostic: Diagnostic, choice: TargetChoice): V
  /** Optional: a profile without it lists on Home by file name, with its check counts. */
  summary?(value: V): ProfileSummary
  /** Optional: the level Home's card draws; a profile without it, or a document with no level, keeps the initial. */
  preview?(value: V): LevelPreview | undefined
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
