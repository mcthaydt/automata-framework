// A suite editor: what an editor gives the suite so the one `EditorShell` can mount it. The
// suite (a host) composes them with `createSuite`, which is the suite's own; this is only the shape and its helper.
// Svelte appears as the `Snippet` type alone, so the headless layers load this file without the compiler.
import type { Snippet } from 'svelte'
import type { SuitePorts, WorkspaceFile } from './suite-ports'

/**
 * The points an editor offers other editors to add to (EDS-D5): a source of bounded tunables in the Tuner and a tab in
 * the Audio editor. Their contribution shapes land with their first consumers.
 */
export type ContributionPoint = 'tuner.source' | 'audio.panel'

/** The shell regions an editor fills, each drawn from its session. The suite owns the top bar; `tools` sits in it. */
export interface SuiteRegions<S> {
  /** Optional: an editor with nothing to list or inspect (the Tuner) gives its column to the canvas. */
  readonly panel?: Snippet<[S]> | undefined
  readonly canvas: Snippet<[S]>
  readonly inspector?: Snippet<[S]> | undefined
  readonly dock?: Snippet<[S]> | undefined
  readonly status?: Snippet<[S]> | undefined
  /** Controls in the top bar, right of the suite's pills. */
  readonly tools?: Snippet<[S]> | undefined
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

/** The one document Ask proposes a whole new text for (EDS-D9), and how the editor takes an accepted one. */
export interface SuiteAskTarget {
  /** The document's workspace path. */
  readonly path: string
  /** The document's text now. */
  text(): string
  /** The ids of the selection the prompt is about (the scope chip; `AskRequest.scope`). */
  scope(): readonly string[]
  /** The key paths the person locked in this session (EDS-D18); a proposal changing one is refused with the key. */
  locked(): readonly string[]
  /** Applies an accepted proposal as one undo step labelled by `summary`. */
  accept(text: string, summary: string): void
}

export interface SuiteEditor<S> {
  /** The id the editor list names: `tuner`, `studio`, `feel`, `levels-2d`, ... */
  readonly id: string
  readonly label: string
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
  /** The session's history; an editor without it has no Undo in the top bar. */
  readonly undo?: ((session: S) => SuiteUndo) | undefined
  /** The session's Ask target; an editor without it has no Ask. */
  readonly ask?: ((session: S) => SuiteAskTarget) | undefined
}

/** Declares a suite editor; the type keeps the regions and the session factory in step. */
export function defineSuiteEditor<S>(editor: SuiteEditor<S>): SuiteEditor<S> {
  return editor
}
