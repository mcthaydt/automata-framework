import type { GeometryState } from '@mcthaydt/automata'
import type { Component, Snippet } from 'svelte'
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import type { DrawView } from '../../shared/level-2d/canvas/draw/draw-list-types'
import type { Camera } from '../../shared/level-2d/canvas/level-view'
import type { OpenDocument } from '../../shared/level-2d/documents/editor-app'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { WorldLink } from '../../shared/level-2d/model/world/world-links'
import type { WorldRect } from '../../shared/level-2d/model/world/world-model'

// What every view (Level, Map, Tiles, Characters) is given. The document screen draws the parts every view shares (the
// top bar with its view switcher, the dialogs and toasts; no rail, no status bar) as snippets, and the view places them
// in its own kit shell beside its panel, canvas and inspector.

export interface ViewFrame {
  /** The top bar; a view that has a place inside the document to show (the Level view's level picker) passes it. */
  readonly topbar: Snippet<[place?: Snippet]>
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
  /**
   * Where a view adds a file of the person's (Add tiles' picture): the game folder, or the workspace in browser
   * storage. Absent where nothing can be written; a view then leaves out what would write.
   */
  readonly files?: Pick<ProjectStore, 'list' | 'write'> | undefined
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
  /** The world map; the Pixi `WorldCanvas` when absent. jsdom has no WebGL, so the DOM tests pass a stand-in. */
  readonly worldCanvas?: Component<WorldCanvasProps> | undefined
}

/** What the World view hands its map (`WorldCanvas.svelte`'s props). */
export interface WorldCanvasProps {
  /** The project the levels' pictures are drawn from. */
  readonly project: Project
  /** Reads a workspace file's bytes, for the pictures' images. */
  readonly read: (path: string) => Promise<Uint8Array | undefined>
  readonly rects: readonly WorldRect[]
  readonly camera: Camera
  /** The links between the levels, drawn over them. */
  readonly links: readonly WorldLink[]
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
  /** The view's name in the switcher. */
  readonly label: string
  readonly frame: ViewFrame
  readonly services: ViewServices
  /** A finding's path the view opens on (Problems' Show); a view that cannot show it ignores it. */
  readonly focus?: string | undefined
}
