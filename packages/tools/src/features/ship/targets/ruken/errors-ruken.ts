import type { ManifestError } from '@ruken/manifest'
import { Data } from 'effect'
import type { TaggedErrorClass } from '../../../../shared/node/errors.ts'

// The Ruken target's own failure (DIST spec §5.2), re-exported by `errors.ts` with every other ship error.

const ManifestInvalidBase: TaggedErrorClass<
  'ManifestInvalid',
  {
    readonly problems: readonly ManifestError[]
  }
> = Data.TaggedError('ManifestInvalid')
/** Ruken's parser refused the generated `ruken.toml`. `problems` are Ruken's own issues, unchanged. */
export class ManifestInvalid extends ManifestInvalidBase {
  override get message(): string {
    return this.problems
      .map((problem) => `ruken.toml ${problem.path || '(file)'}: ${problem.message}`)
      .join('\n')
  }
}
