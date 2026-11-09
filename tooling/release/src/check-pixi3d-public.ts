// Usage: node tooling/release/src/check-pixi3d-public.ts   (run first by `pnpm release`, before anything is built or published)
//
// `@automata/tools` ships the editors' page, and that page carries Pixi 3D, a closed beta whose terms allow no public
// deployment. The Owner's rule is that AF launches when Pixi 3D goes public, so a release stops here while any package
// still takes `@pixi/3d` from the vendored tarball (`vendor/pixi-3d`). Switching those specifiers to the registry's release
// is what lifts the block; there is no flag to skip it.
import { fileURLToPath } from 'node:url'
import { publishablePackages, type WorkspacePackage, workspacePackages } from './publishable-packages.ts'

const TOOLS = '@automata/tools'

/** The packages whose `@pixi/3d` is a `file:` specifier, that is, the vendored beta. */
function vendoredBeta(packages: readonly WorkspacePackage[]): string[] {
  return packages
    .filter(({ manifest }) =>
      [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies].some((group) =>
        group?.['@pixi/3d']?.startsWith('file:'),
      ),
    )
    .map(({ manifest }) => manifest.name)
}

/** Why a release must not go out, or `undefined` when it may. `packages` is every workspace package. */
export function pixi3dPublishBlock(packages: readonly WorkspacePackage[]): string | undefined {
  const published = packages.some(({ manifest }) => manifest.name === TOOLS && manifest.private !== true)
  const beta = vendoredBeta(packages)
  if (!published || beta.length === 0) return undefined
  return `${TOOLS} ships the editors' page, which carries the Pixi 3D beta, and Pixi 3D is not public yet. Packages still on the vendored beta: ${beta.join(', ')}. Publish after they take @pixi/3d from the registry.`
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const block = pixi3dPublishBlock(workspacePackages(root))
  if (block !== undefined) {
    console.error(`Release refused: ${block}`)
    process.exit(1)
  }
  console.log(`Pixi 3D check: ${publishablePackages(root).length} packages may be published.`)
}
