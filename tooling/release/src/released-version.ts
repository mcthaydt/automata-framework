// Usage: PUBLISHED='<changesets/action published-packages>' node tooling/release/src/released-version.ts
// Prints the one version the release published (release-packages.yml passes it to verify-published and the
// registry consumer smoke). Fails if the packages disagree, which the fixed group should make impossible.
import { releasedVersion } from './verify-published.ts'

console.log(releasedVersion(process.env.PUBLISHED ?? '[]'))
