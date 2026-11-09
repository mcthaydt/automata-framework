// A suite editor: what an editor gives the suite so the one `EditorShell` can mount it. The
// suite (a host) composes them with `createSuite`, which is the suite's own; this is only the shape and its helper.
// Svelte appears as the `Snippet` type alone, so the headless layers load this file without the compiler.
import type { Snippet } from 'svelte'
import type { Readable } from 'svelte/store'
import type { IconName } from '../icons/paths'
import type { ShellMode } from '../shell/shell-mode'
import type { SuitePorts, WorkspaceFile } from './suite-ports'

/**
 * The points an editor offers other editors to add to (EDS-D5): a source of bounded tunables in the Tuner and a tab in
 * the Audio editor. Their contribution shapes land with their first consumers.
 */
export type ContributionPoint = 'tuner.source' | 'audio.panel'

/** What the suite tells the canvas about the window it is drawn in, so it can place its own tools (a dock on a phone). */
export interface CanvasContext {
  readonly mode: ShellMode
}

/** The shell regions an editor fills, each drawn from its session. The suite owns the top bar; `tools` sits in it. */
export interface SuiteRegions<S> {
  /** Optional: an editor with nothing to list or inspect (the Tuner) gives its column to the canvas. */
  readonly panel?: Snippet<[S]> | undefined
  readonly canvas: Snippet<[S, CanvasContext]>
  readonly inspector?: Snippet<[S]> | undefined
  readonly dock?: Snippet<[S]> | undefined
  readonly status?: Snippet<[S]> | undefined
  /** Controls in the top bar, right of the suite's pills. */
  readonly tools?: Snippet<[S]> | undefined
}

/** One row of the document menu; a disabled row stays in it and says why. */
export interface HeaderItem {
  readonly id: string
  readonly label: string
  readonly detail?: string | undefined
  readonly disabled?: boolean | undefined
  readonly reason?: string | undefined
}

/**
 * What an editor puts in the header's breadcrumb beside its own name (Levels / Start): the open document and the actions on
 * it, and the views of one thing (Level, Tiles). Either may be left out.
 */
export interface EditorHeader {
  readonly doc?:
    | {
        readonly name: string
        readonly items: readonly (HeaderItem | 'separator')[]
        readonly onselect: (id: string) => void
      }
    | undefined
  readonly views?:
    | {
        readonly label: string
        readonly options: readonly { readonly id: string; readonly label: string }[]
        readonly value: string
        readonly onchange: (id: string) => void
      }
    | undefined
}

/** The active editor's history, as the suite's top bar sees it: Undo, Redo, `Mod+Z` and `Mod+Shift+Z` (EDS-D19). */
export interface SuiteUndo {
  canUndo(): boolean
  canRedo(): boolean
  /** What Undo would take back ("Undo Raise speed"), or `undefined` with nothing to undo. */
  undoLabel(): string | undefined
  redoLabel(): string | undefined
  undo(): void
  redo(): void
  /** Called after every change to the history; gives back the unsubscribe. */
  subscribe(listener: () => void): () => void
}

/** The kind of game an editor is for: the level editors and the figure editors differ between them. */
export type EditorKind = '2d' | '3d'

/**
 * One rail entry of an editor that has more than one. Each names the view of the editor's one session it opens.
 * The first entry's id is the editor's own id.
 */
export interface SuiteEntryDef {
  readonly id: string
  /** The entry's name for one kind of game (the rail adds " 2D" or " 3D" when it shows both kinds). */
  readonly label: string
  readonly icon: IconName
  readonly kind?: EditorKind | undefined
  /** What `showView` is asked to show when the entry is chosen. */
  readonly view: string
}

export interface SuiteEditor<S> {
  /** The id the editor list names: `tuner`, `studio`, `feel`, `levels-2d`, ... */
  readonly id: string
  /** The editor's name for one kind of game; the rail adds " 2D" or " 3D" only when it shows both kinds. */
  readonly label: string
  /** The kind of game it is for; none means both. */
  readonly kind?: EditorKind | undefined
  /** The icon's name in the suite's icon set. */
  readonly icon: string
  /** The editor's `color/ed/*` token. */
  readonly hue: string
  /**
   * Opens the files of one editor-list row group for a scene (or the whole game) into a session: its documents,
   * history, selection and view state, which outlive the view (EDS-D12). Never rejects for a bad file: that is a state.
   */
  open(files: readonly WorkspaceFile[], ports: SuitePorts): Promise<S>
  /**
   * The rows Home shows for this editor's files, when fewer than one per file reads better (Schematic's scene is three
   * files and one thing to open). Opening a row opens the editor with all of its files either way (`EditorCard.files`).
   */
  readonly homeFiles?: ((files: readonly WorkspaceFile[]) => readonly WorkspaceFile[]) | undefined
  readonly regions: SuiteRegions<S>
  readonly contributions?: readonly ContributionPoint[] | undefined
  /**
   * The header's breadcrumb for this session, as a store that follows the open document and the view; `undefined`
   * says there is nothing to add (the header shows the editor's name alone). Without it the same.
   */
  readonly header?: ((session: S) => Readable<EditorHeader | undefined>) | undefined
  /**
   * The rail entries this editor gives, when it gives more than one: they share the editor's one session, history and
   * write queue, and differ in the view they show. Absent: one entry, the editor itself.
   */
  readonly entries?: readonly SuiteEntryDef[] | undefined
  /**
   * What a view-only card on Home lists, by name ("Hero · Slime"), read from the editor's files before it is opened.
   * Without it such a card shows only its name. Called once per entry that names a `view`.
   */
  readonly homeNames?:
    | ((
        view: string,
        files: readonly WorkspaceFile[],
        read: (path: string) => Promise<string | undefined>,
      ) => Promise<readonly string[]>)
    | undefined
  /** Shows the view a chosen entry names, before the editor's regions draw. Required with `entries`. */
  readonly showView?: ((session: S, view: string) => void) | undefined
  /** The session's history; an editor without it has no Undo in the top bar. */
  readonly undo?: ((session: S) => SuiteUndo) | undefined
}

/** Declares a suite editor; the type keeps the regions and the session factory in step. */
export function defineSuiteEditor<S>(editor: SuiteEditor<S>): SuiteEditor<S> {
  return editor
}
