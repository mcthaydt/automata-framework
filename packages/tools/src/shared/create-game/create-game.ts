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

export function createGame(options: CreateGameOptions): Effect.Effect<CreateGameResult, CreateGameError> {
  return Effect.gen(function* () {
    if (!ID_REGEX.test(options.id)) {
      return yield* Effect.fail(
        new CreateGameError({
          reason: 'invalid-id',
          message: `"${options.id}" can't be a game id. Use lowercase letters, digits and hyphens, like my-game.`,
        }),
      )
    }

    if (options.targets !== undefined) {
      const checked = parseTargets(options.targets.join(','))
      if (!checked.ok)
        return yield* Effect.fail(
          new CreateGameError({ reason: 'invalid-targets', message: checked.message }),
        )
    }

    if (existsSync(options.targetDir)) {
      const existingFiles = readdirSync(options.targetDir)
      if (existingFiles.length > 0) {
        return yield* Effect.fail(
          new CreateGameError({
            reason: 'target-directory-exists',
            message: `${options.targetDir} already has files in it. Pick a new folder.`,
          }),
        )
      }
    }

    const createdFiles: string[] = []
    let createdTargetDir = false

    try {
      if (!existsSync(options.targetDir)) {
        mkdirSync(options.targetDir, { recursive: true })
        createdTargetDir = true
      }

      for (const tpl of TEMPLATE_FILES) {
        const fullPath = join(options.targetDir, tpl.path)
        const dir = dirname(fullPath)
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(fullPath, tpl.content(options), 'utf8')
        createdFiles.push(tpl.path)
      }
    } catch (cause) {
      if (createdTargetDir) {
        try {
          rmSync(options.targetDir, { recursive: true, force: true })
        } catch {
          // ignore cleanup errors
        }
      }
      return yield* Effect.fail(
        new CreateGameError({
          reason: 'write-failed',
          message: `Couldn't write the game's files: ${cause instanceof Error ? cause.message : String(cause)}`,
        }),
      )
    }

    return {
      targetDir: options.targetDir,
      id: options.id,
      title: options.title,
      createdFiles,
    }
  })
}
