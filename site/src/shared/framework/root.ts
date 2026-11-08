import { fileURLToPath } from 'node:url'

// The site lives inside the framework's repository (site/), so it reads the framework's own files at build time
// instead of syncing copies of them: a page that describes a file breaks in the same pull request as the file.

/** The repository root: four folders up from site/src/shared/framework/. */
export const repositoryRoot: string = fileURLToPath(new URL('../../../../', import.meta.url))
