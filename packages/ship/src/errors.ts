import type { ManifestError } from '@ruken/manifest'
import { Data } from 'effect'

// Every way a ship step can fail, as tagged errors (ADR 0003). The CLI prints `message`, one line per problem.

/** Ruken's parser refused the generated `ruken.toml`. `problems` are Ruken's own issues, unchanged. */
export class ManifestInvalid extends Data.TaggedError('ManifestInvalid')<{
  readonly problems: readonly ManifestError[]
}> {
  override get message(): string {
    return this.problems
      .map((problem) => `ruken.toml ${problem.path || '(file)'}: ${problem.message}`)
      .join('\n')
  }
}
