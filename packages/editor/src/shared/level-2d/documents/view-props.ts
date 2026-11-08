import type { GeometryState } from '@automata/framework'
import type { Component, Snippet } from 'svelte'
import type { GestureClock } from '../../kit/gestures/gesture-clock'
import type { ProjectStore } from '../../kit/storage/project-store'
import type { DrawView } from '../canvas/draw/draw-list-types'
import type { Camera } from '../canvas/level-view'
import type { IdSource } from '../model/ids'
import type { Project } from '../model/project-types'
import type { OpenDocument } from './editor-app'

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
   * The gesture recognizer's time (a tap's length, a long press); the browser's when absent. A journey passes its test
   * clock, so a slow machine cannot stretch a tap into a press.
   */
  readonly gestureClock?: GestureClock | undefined
  /**
   * The level canvas component; the Pixi `LevelCanvas` when absent. jsdom has no WebGL or `ResizeObserver`, so the DOM
   * tests pass a plain stand-in, as editor-3d's plan canvas takes a renderer factory.
   */
  readonly canvas?: Component<LevelCanvasProps> | undefined
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
