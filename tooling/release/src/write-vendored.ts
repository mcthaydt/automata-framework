// Writes `VENDORED.md` into a published package that bundles vendored Ruken code (D-8, M2.4 spec §3.2): which
// RukenApp commit it carries and each bundled package's tarball with its SHA-256, copied from
// `vendor/ruken/README.md` so a published package always says which Ruken is inside it. Run by each such
// package's build (`tsdown-shared.ts`).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** `| \`ruken-sdk-0.0.0.tgz\` | \`@ruken/sdk\` | …` rows of the README's table. */
const TABLE_ROW = /^\| `([\w.-]+\.tgz)` \| `(@ruken\/[\w-]+)`/gm
/** `RukenApp \`main\` at \`b30d31b\`` */
const SOURCE_COMMIT = /RukenApp `[\w-]+` at `([0-9a-f]{7,40})`/
/** `<sha256>  <tarball>` lines of the hash block. */
const HASH_LINE = /^([0-9a-f]{64}) {2}([\w.-]+\.tgz)$/gm

export function vendoredNotice(readme: string, packageName: string, bundled: readonly string[]): string {
  const commit = SOURCE_COMMIT.exec(readme)?.[1]
  if (commit === undefined) throw new Error('vendor/ruken/README.md does not name the RukenApp source commit')
  const tarballOf = new Map([...readme.matchAll(TABLE_ROW)].map((row) => [row[2], row[1]]))
  const hashOf = new Map([...readme.matchAll(HASH_LINE)].map((line) => [line[2], line[1]]))

  const rows = bundled.map((name) => {
    const tarball = tarballOf.get(name)
    if (tarball === undefined) throw new Error(`vendor/ruken/README.md does not vendor ${name}`)
    const hash = hashOf.get(tarball)
    if (hash === undefined) throw new Error(`vendor/ruken/README.md has no SHA-256 for ${tarball}`)
    return `| \`${name}\` | \`${tarball}\` | \`${hash}\` |`
  })

  return [
    '# Vendored Ruken code',
    '',
    `\`${packageName}\` bundles these Ruken packages into its \`dist/\`, because Ruken does not publish them yet`,
    '(AF decisions D-6 and D-8). They were packed from RukenApp at commit',
    `\`${commit}\`; the hashes are of the tarballs in automata-framework's \`vendor/ruken/\`.`,
    '',
    '| Package | Tarball | SHA-256 |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}

export interface WriteVendoredOptions {
  /** The repository root (where `vendor/ruken/README.md` is). */
  readonly root: string
  readonly packageDir: string
  readonly packageName: string
  readonly bundled: readonly string[]
}

export function writeVendored(options: WriteVendoredOptions): void {
  const readme = readFileSync(join(options.root, 'vendor/ruken/README.md'), 'utf8')
  writeFileSync(
    join(options.packageDir, 'VENDORED.md'),
    vendoredNotice(readme, options.packageName, options.bundled),
  )
}
