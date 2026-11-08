import type { History } from '../../kit/history/history.ts'
import type { DocumentSession, SaveOutcome } from '../../kit/storage/document-session.ts'
import type { StorageFailure } from '../../kit/storage/project-store.ts'
import type { Recovery } from '../../kit/storage/recovery.ts'
import type { Workspace } from '../../kit/storage/workspace.ts'
import type {
  LevelPreview,
  ParseError,
  Profile,
  ProfileRegistry,
  ProfileSummary,
  Result,
} from '../profiles/profile'

// The contract between the 2D editor's app and its views: what the editor's session over a
// workspace offers (`EditorApp`), the open document it hands out, how each action can end, and the project list Home
// shows. Types only, so a feature depends on this and not on the app that implements it.

export interface Listed {
  readonly path: string
  readonly size: number
  readonly mtime: number
}

/** A card's preview level, stamped with what its thumbnail is drawn from besides the file itself. */
export type CardPreview = LevelPreview & {
  /**
   * The level's image paths with their modification times (`assets/terrain.png@1700000000000`, or `@missing`), so a
   * replaced or newly imported image gives the card a new thumbnail key.
   */
  readonly images: string
}

export interface ProfileRef {
  readonly id: string
  readonly label: string
}

export type ProjectEntry =
  | (Listed & {
      readonly status: 'ok'
      readonly profile: ProfileRef
      /** Findings of the profile's checks, by severity; info is not counted. */
      readonly errors: number
      readonly warnings: number
      /** The profile's words for what the project holds; `undefined` when the profile gives none. */
      readonly summary: ProfileSummary | undefined
      /** The level the card draws as a thumbnail; `undefined` when the profile has none to show. */
      readonly preview: CardPreview | undefined
    })
  /** A profile claims the file and it does not open: Home shows the reason and offers the text view. */
  | (Listed & { readonly status: 'broken'; readonly profile: ProfileRef; readonly message: string })
  | (Listed & { readonly status: 'ambiguous'; readonly candidates: readonly ProfileRef[] })

/** One open document: the profile, its history and its save flow. The value type is the profile's; the view that knows it narrows it. */
export interface OpenDocument {
  readonly profile: Profile<unknown>
  readonly path: string
  readonly history: History<unknown>
  readonly session: DocumentSession
  save(): Promise<SaveOutcome>
  /** Keep mine: writes without checking that the file is still the one that was opened. */
  overwrite(): Promise<SaveOutcome>
  /** Save as copy: the first unused `name copy.ext`; the document keeps its own path. */
  saveCopy(): Promise<SaveOutcome>
  /** The folder Save also writes the game's files into (a checkout whose editor list says so); `undefined` otherwise. */
  readonly gameFolder: string | undefined
  /** The text the document was loaded or last saved as, which a profile's export targets patch. */
  base(): string
  /** Applies an autosave as one undoable step, which leaves the document dirty. Refused, changing nothing, when the payload no longer parses. */
  restore(recovery: Recovery): Result<true, readonly ParseError[]>
  discardRecovery(): Promise<void>
  dispose(): void
}

export type OpenOutcome =
  | {
      readonly status: 'opened'
      readonly document: OpenDocument
      /** An autosave newer than the file, for the dialog to offer. */
      readonly recovery: Recovery | undefined
      /** Set when the autosave could not be read: the document opened anyway. */
      readonly recoveryError?: string | undefined
    }
  | {
      readonly status: 'choose'
      readonly path: string
      readonly candidates: readonly Profile<unknown>[]
      readonly text: string
    }
  | { readonly status: 'unrecognised'; readonly path: string; readonly text: string }
  | {
      readonly status: 'invalid'
      readonly path: string
      readonly profile: Profile<unknown>
      readonly errors: readonly ParseError[]
      readonly text: string
    }
  | { readonly status: 'notText' | 'missing'; readonly path: string }
  | { readonly status: 'tooLarge'; readonly path: string; readonly bytes: number }
  /** The store refused: a read that was denied, or a create that hit a full disk. */
  | {
      readonly status: 'storageFailed'
      readonly path: string
      readonly reason: StorageFailure
      readonly message: string
    }

export type CopyOutcome =
  | { readonly status: 'copied'; readonly path: string }
  | { readonly status: 'missing'; readonly path: string }
  | {
      readonly status: 'failed'
      readonly path: string
      readonly reason: StorageFailure
      readonly message: string
    }

export type ImportOutcome =
  | { readonly status: 'imported'; readonly name: string; readonly path: string }
  /** Nothing was written: no profile claims the file, it is not text, or it is over the size limit. */
  | {
      readonly status: 'refused'
      readonly name: string
      readonly reason: 'unrecognised' | 'notText' | 'tooLarge'
    }
  | {
      readonly status: 'failed'
      readonly name: string
      readonly reason: StorageFailure
      readonly message: string
    }

export interface EditorApp {
  readonly registry: ProfileRegistry
  readonly workspace: Workspace
  /** The projects Home shows, newest first. Rejects when the workspace cannot be listed. */
  list(): Promise<readonly ProjectEntry[]>
  /** Writes the template's working file (a taken path gets ` 2`, ` 3`) and opens it the way an existing file opens. */
  create(profileId: string, templateId: string): Promise<OpenOutcome>
  /** `as` is the id of the profile the person chose after a `choose`. */
  open(path: string, as?: string): Promise<OpenOutcome>
  /** Copies the file's bytes to the first unused `name copy.ext`, `name copy 2.ext`; a file that does not open copies too. */
  duplicate(path: string): Promise<CopyOutcome>
  /** Deletes the file and its autosave. A path with no file is not an error. */
  remove(path: string): Promise<void>
  /**
   * Keeps a file the person picked, under its own name (a taken name gets ` 2`, ` 3`). A file a profile claims is kept
   * as it is, even when it does not open, so the error panel can show why; any other file is refused.
   */
  importFile(name: string, bytes: Uint8Array): Promise<ImportOutcome>
}
