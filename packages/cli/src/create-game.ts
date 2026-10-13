import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import { Data, Effect } from 'effect'

export interface CreateGameOptions {
  readonly targetDir: string
  readonly id: string
  readonly title: string
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
    readonly reason: 'target-directory-exists' | 'invalid-id' | 'write-failed'
    readonly message: string
  }
> = Data.TaggedError('CreateGameError')

export class CreateGameError extends CreateGameErrorBase {}

export function createGame(_options: CreateGameOptions): Effect.Effect<CreateGameResult, CreateGameError> {
  return Effect.die('not implemented')
}
