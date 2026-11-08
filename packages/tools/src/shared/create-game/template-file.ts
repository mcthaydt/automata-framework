import { DEFAULT_TARGETS, type DistTarget } from './create-game-targets.ts'
import { toolsVersion } from './tools-version.ts'

// What a template file is, and what it is made from: the options `create-game` was given.

/** The kinds of game `create-game` makes: the 2D square in a level (default), or Wick in a 3D room. */
export const TEMPLATES = ['2d', '3d'] as const

export type TemplateKind = (typeof TEMPLATES)[number]

export interface TemplateOptions {
  readonly id: string
  readonly title: string
  /** Which game to make; default `2d`. */
  readonly template?: TemplateKind | undefined
  /** Whether the 2D game has the story (a keeper, a cutscene and a guard); it needs packages that are not public yet (story-gate.ts). */
  readonly story?: boolean | undefined
  /** The distribution targets to build for; default web and itch.io. */
  readonly targets?: readonly DistTarget[] | undefined
  /**
   * Ask for `workspace:*` instead of the published version. Only for a game made inside this repository's workspace
   * (the repository's own tests); anywhere else the packages come from a registry.
   */
  readonly linkWorkspace?: boolean | undefined
}

export const targetsOf = (options: TemplateOptions): readonly DistTarget[] =>
  options.targets ?? DEFAULT_TARGETS

/** What the game asks for of each framework package: the version of the tools that made it (read once). */
export const frameworkSpec = (options: TemplateOptions): string =>
  options.linkWorkspace === true ? 'workspace:*' : `^${toolsVersion()}`

export interface TemplateFile {
  readonly path: string
  readonly content: (options: TemplateOptions) => string
}
