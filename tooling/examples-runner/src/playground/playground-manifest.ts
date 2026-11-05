import { createHash } from 'node:crypto'

// The playground build's manifest: which framework commit and site origin it was built
// for, every file it wrote with its size and sha256, and every package the runtime bundles with the version and
// licence read from its installed package.json. The site's sync checks the copy against it and shows the licences
// from it; nobody types a licence by hand.

export interface ManifestInput {
  readonly framework: string
  readonly siteOrigin: string
  readonly files: readonly { readonly path: string; readonly bytes: Uint8Array }[]
  readonly packages: readonly {
    readonly name: string
    readonly version: string
    readonly licence: string | undefined
  }[]
}

export interface PlaygroundManifest {
  readonly framework: string
  readonly siteOrigin: string
  readonly files: readonly { readonly path: string; readonly bytes: number; readonly sha256: string }[]
  readonly packages: readonly { readonly name: string; readonly version: string; readonly licence: string }[]
}

const byKey =
  <T>(key: (item: T) => string) =>
  (a: T, b: T): number =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0

export function playgroundManifest(input: ManifestInput): PlaygroundManifest {
  const packages = input.packages.map(({ name, version, licence }) => {
    if (licence === undefined || licence === '')
      throw new Error(`${name}@${version} declares no licence; the playground cannot publish it`)
    return { name, version, licence }
  })
  return {
    framework: input.framework,
    siteOrigin: input.siteOrigin,
    files: input.files
      .map(({ path, bytes }) => ({
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      }))
      .sort(byKey((file) => file.path)),
    packages: packages.sort(byKey((pkg) => pkg.name)),
  }
}
