// What must not reach a public build yet: a link to the private repository, and the closed beta of Pixi 3D.
import { findPixi3d } from '@mcthaydt/automata-tools/internal'
import { REPOSITORY, REPOSITORY_PUBLIC } from '../../src/shared/site.js'

/** A page or text file that points at the framework's repository while it is private (a visitor would meet a 404). */
export function checkPrivateRepository(file: string, content: string): string[] {
  if (REPOSITORY_PUBLIC || !content.toLowerCase().includes(REPOSITORY)) return []
  return [`${file}: links to the private repository (${REPOSITORY})`]
}

/**
 * `@pixi/3d` is a closed beta whose terms allow no public deployment, so no script of the build may carry it or its
 * extras. The scan is the one a game's own build runs (the tools' `findPixi3d`).
 */
export function checkClosedBeta(root: string): string[] {
  const { core, extras } = findPixi3d(root)
  return [...core, ...extras].map(
    ({ file, marker }) => `${file}: carries @pixi/3d (${marker}), a closed beta that cannot be deployed`,
  )
}
