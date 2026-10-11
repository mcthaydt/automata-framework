/**
 * A release's version must be its tag's (FloorFifty `deploy/tools/ruken-pack.ts`): the build Ruken shows as
 * 0.10.2 is the one tagged v0.10.2. A branch build has no tag and passes. Returns what is wrong, or undefined.
 */
export function checkVersion(version: string, tag: string | undefined): string | undefined {
  if (tag === undefined || tag === `v${version}`) return undefined
  return `the game is at version ${version} but the tag is ${tag}`
}
