import { DEFAULT_TARGETS, type DistTarget } from './create-game-targets.ts'

// What a template file is, and what it is made from: the options `create-game` was given.

export interface TemplateOptions {
  readonly id: string
  readonly title: string
  /** The distribution targets to build for; default web and itch.io. */
  readonly targets?: readonly DistTarget[] | undefined
  /**
   * Ask for `workspace:*` instead of the published version. Only for a game made inside this repository's workspace
   * (the repository's own tests); anywhere else the packages come from a registry.
   */
  readonly linkWorkspace?: boolean | undefined
  /**
   * The version of the framework packages the game asks for. `create-game` fills it from the tools' own version; the
   * Automata app passes the version it carries. Needed unless `linkWorkspace` is set.
   */
  readonly frameworkVersion?: string | undefined
}

/** A game id: lowercase letters, digits and single hyphens, so never a path. */
export const ID_REGEX: RegExp = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const targetsOf = (options: TemplateOptions): readonly DistTarget[] =>
  options.targets ?? DEFAULT_TARGETS

/** What the game asks for of each framework package: the framework version it was made with, which every published package shares. */
export function frameworkSpec(options: TemplateOptions): string {
  if (options.linkWorkspace === true) return 'workspace:*'
  if (options.frameworkVersion === undefined)
    throw new Error('A game needs the framework version it is made for.')
  return `^${options.frameworkVersion}`
}

export interface TemplateFile {
  readonly path: string
  readonly content: (options: TemplateOptions) => string
}
