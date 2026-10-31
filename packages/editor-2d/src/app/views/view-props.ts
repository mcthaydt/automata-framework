import type { GeometryState } from '@mcthaydt/automata-ui'
import type { Component, Snippet } from 'svelte'
import type { DrawView } from '../../canvas/draw/draw-list-types'
import type { Camera } from '../../canvas/level-view'
import type { IdSource } from '../../model/ids'
import type { Project } from '../../model/project-types'
import type { OpenDocument } from '../editor-app'
import type { WorldRect } from '../world/world-model'

// What every rail destination is given (plan ED2D.4c4a decision 1). The document screen draws the parts every view
// shares (the top bar, the rail, the status line, the dialogs and toasts) as snippets, and the view places them in its
// own kit shell beside its panel, canvas and inspector.

export interface ViewFrame {
  readonly topbar: Snippet
  readonly rail: Snippet<[{ orientation: 'vertical' | 'horizontal' }]>
  readonly status: Snippet
  readonly sheets: Snippet
}

/** Makes a URL a CSS background can show for an image's bytes, and lets it go (the browser's object URLs). */
export interface ObjectUrls {
  create(bytes: Uint8Array): string
  revoke(url: string): void
}

export interface ViewServices {
  /** Reads a workspace file's bytes (the workspace store's `read`). */
  readonly read: (path: string) => Promise<Uint8Array | undefined>
  /** Where the ids of placed instances come from. */
  readonly ids: IdSource
  /** Absent where there are none (jsdom): the palette shows numbered tiles. */
  readonly objectUrls?: ObjectUrls | undefined
  readonly onundo: () => void
  readonly onredo: () => void
  /**
   * The level canvas component; the Pixi `LevelCanvas` when absent. jsdom has no WebGL or `ResizeObserver`, so the DOM
   * tests pass a plain stand-in, as editor-3d's plan canvas takes a renderer factory.
   */
  readonly canvas?: Component<LevelCanvasProps> | undefined
  /**
   * Opens the profile's first view on what a finding's path names (the Checks view's Locate, plan ED2D.7a decision 4).
   * Absent where nothing can be located.
   */
  readonly locate?: ((path: string) => void) | undefined
  /** The world map; the Pixi `WorldCanvas` when absent. jsdom has no WebGL, so the DOM tests pass a stand-in. */
  readonly worldCanvas?: Component<WorldCanvasProps> | undefined
}

/** What the World view hands its map (`WorldCanvas.svelte`'s props). */
export interface WorldCanvasProps {
  readonly rects: readonly WorldRect[]
  readonly camera: Camera
}

/** What the Level view hands its canvas (`LevelCanvas.svelte`'s props). */
export interface LevelCanvasProps {
  readonly project: Project
  readonly view: DrawView
  readonly read: (path: string) => Promise<Uint8Array | undefined>
  readonly camera?: Camera | undefined
}

export interface ViewProps {
  readonly geometry: GeometryState
  readonly document: OpenDocument
  /** The rail entry's label. */
  readonly label: string
  readonly frame: ViewFrame
  readonly services: ViewServices
  /** A finding's path the view opens on (Locate); a view that cannot show it ignores it. */
  readonly focus?: string | undefined
}
