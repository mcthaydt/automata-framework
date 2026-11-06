// Makes a new game's folder from the template (`automata create-game`): checks the id, the targets and the folder first,
// then writes every file, undoing the folder it made if a write fails.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Data, Effect } from 'effect'
import type { TaggedErrorClass } from '../node/errors.ts'
import { parseTargets } from './create-game-targets.ts'
import { TEMPLATE_FILES, type TemplateOptions } from './template.ts'

export interface CreateGameOptions extends TemplateOptions {
  readonly targetDir: string
  readonly description?: string | undefined
  readonly author?: string | undefined
}

export interface CreateGameResult {
  readonly targetDir: string
  readonly id: string
  readonly title: string
  readonly createdFiles: readonly string[]
}

const CreateGameErrorBase: TaggedErrorClass<
  'CreateGameError',
  {
    readonly reason: 'target-directory-exists' | 'invalid-id' | 'invalid-targets' | 'write-failed'
    readonly message: string
  }
> = Data.TaggedError('CreateGameError')

export class CreateGameError extends CreateGameErrorBase {}

/** A game id: lowercase letters, digits and single hyphens, so never a path. */
export const ID_REGEX: RegExp = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** The first reason `options` cannot make a game (a bad id, bad targets, a folder with files in it), if there is one. */
function whyNot(options: CreateGameOptions): CreateGameError | undefined {
  if (!ID_REGEX.test(options.id)) {
    return new CreateGameError({
      reason: 'invalid-id',
      message: `"${options.id}" can't be a game id. Use lowercase letters, digits and hyphens, like my-game.`,
    })
  }
  if (options.targets !== undefined) {
    const checked = parseTargets(options.targets.join(','))
    if (!checked.ok) return new CreateGameError({ reason: 'invalid-targets', message: checked.message })
  }
  if (existsSync(options.targetDir) && readdirSync(options.targetDir).length > 0) {
    return new CreateGameError({
      reason: 'target-directory-exists',
      message: `${options.targetDir} already has files in it. Pick a new folder.`,
    })
  }
  return undefined
}

/**
 * Writes every template file and returns their paths. A folder this made is removed again when a write fails, so a
 * failed run leaves nothing behind; a folder that was already there (and empty) is left as it was.
 */
function writeTemplate(options: CreateGameOptions): string[] {
  const createdFiles: string[] = []
  const madeTargetDir = !existsSync(options.targetDir)
  try {
    for (const tpl of TEMPLATE_FILES) {
      const fullPath = join(options.targetDir, tpl.path)
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, tpl.content(options), 'utf8')
      createdFiles.push(tpl.path)
    }
  } catch (cause) {
    if (madeTargetDir) {
      try {
        rmSync(options.targetDir, { recursive: true, force: true })
      } catch {
        // The write's failure is the one to report, not the clean-up's.
      }
    }
    throw cause
  }
  return createdFiles
}

/** Makes the game's folder from the template, or says why it cannot. Nothing is written until the options are valid. */
export function createGame(options: CreateGameOptions): Effect.Effect<CreateGameResult, CreateGameError> {
  return Effect.gen(function* () {
    const problem = whyNot(options)
    if (problem !== undefined) return yield* Effect.fail(problem)

    const createdFiles = yield* Effect.try({
      try: () => writeTemplate(options),
      catch: (cause) =>
        new CreateGameError({
          reason: 'write-failed',
          message: `Couldn't write the game's files: ${cause instanceof Error ? cause.message : String(cause)}`,
        }),
    })
    return { targetDir: options.targetDir, id: options.id, title: options.title, createdFiles }
  })
}
