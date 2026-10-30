// A suite editor (editor suite spec §4.1): what an editor gives the suite so the one `EditorShell` can mount it. The
// suite (a host) composes them with `createSuite`, which is the suite's own; this is only the shape and its helper.
// Svelte appears as the `Snippet` type alone, so the headless layers load this file without the compiler.
import type { Snippet } from 'svelte'
import type { SuitePorts, WorkspaceFile } from './suite-ports'

/**
 * The points an editor offers other editors to add to (EDS-D5): a source of bounded tunables in the Tuner and a tab in
 * the Audio editor. Their contribution shapes land with their first consumers (EDS.4a and EDS.5a).
 */
export type ContributionPoint = 'tuner.source' | 'audio.panel'

/** The shell regions an editor fills, each drawn from its session. The suite owns the top bar; `tools` sits in it. */
export interface SuiteRegions<S> {
  readonly panel: Snippet<[S]>
  readonly canvas: Snippet<[S]>
  readonly inspector: Snippet<[S]>
  readonly dock?: Snippet<[S]> | undefined
  readonly status?: Snippet<[S]> | undefined
  /** Controls in the top bar, right of the suite's pills. */
  readonly tools?: Snippet<[S]> | undefined
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
  readonly regions: SuiteRegions<S>
  readonly contributions?: readonly ContributionPoint[] | undefined
}

/** Declares a suite editor; the type keeps the regions and the session factory in step. */
export function defineSuiteEditor<S>(editor: SuiteEditor<S>): SuiteEditor<S> {
  return editor
}
