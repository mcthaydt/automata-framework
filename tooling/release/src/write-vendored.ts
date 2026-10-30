// Writes `VENDORED.md` into a published package that bundles vendored Ruken code (D-8, M2.4 spec §3.2): which
// RukenApp commit it carries and each bundled package's tarball with its SHA-256, copied from
// `vendor/ruken/README.md` so a published package always says which Ruken is inside it, and each bundled
// package's licence with its text, read from the installed tarball (PRODUCT.4r): Ruken's packages are MIT, whose
// notice must travel with every copy of the code. Run by each such package's build (`tsdown-shared.ts`).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** `| \`ruken-sdk-0.0.0.tgz\` | \`@ruken/sdk\` | …` rows of the README's table. */
const TABLE_ROW = /^\| `([\w.-]+\.tgz)` \| `(@ruken\/[\w-]+)`/gm
/** `RukenApp \`main\` at \`b30d31b\`` */
const SOURCE_COMMIT = /RukenApp `[\w-]+` at `([0-9a-f]{7,40})`/
/** `<sha256>  <tarball>` lines of the hash block. */
const HASH_LINE = /^([0-9a-f]{64}) {2}([\w.-]+\.tgz)$/gm
/** `LICENSE`, `LICENSE.md`, `LICENCE.txt`: the file a package's licence text is in. */
const LICENSE_FILE = /^licen[cs]e(\.|$)/i

/** A bundled package's licence, as its installed copy declares it. */
export interface BundledLicense {
  /** The `license` field of its package.json, e.g. `MIT`. */
  readonly license: string
  /** Its LICENSE file, which the licence asks every copy of the code to carry. */
  readonly text: string
}

/**
 * The licence texts, each once, under the packages that share it (in the order given). Ruken's four packages carry
 * the same MIT text, so the notice prints it once rather than four times.
 */
function licenseSections(
  bundled: readonly string[],
  licenses: ReadonlyMap<string, BundledLicense>,
): string[] {
  const packagesByText = new Map<string, string[]>()
  for (const name of bundled) {
    const text = licenses.get(name)?.text ?? ''
    packagesByText.set(text, [...(packagesByText.get(text) ?? []), name])
  }
  return [...packagesByText].flatMap(([text, names]) => [
    `### ${names.map((name) => `\`${name}\``).join(', ')}`,
    '',
    '```text',
    text.endsWith('\n') ? text.slice(0, -1) : text,
    '```',
    '',
  ])
}

export function vendoredNotice(
  readme: string,
  packageName: string,
  bundled: readonly string[],
  licenses: ReadonlyMap<string, BundledLicense>,
): string {
  const commit = SOURCE_COMMIT.exec(readme)?.[1]
  if (commit === undefined) throw new Error('vendor/ruken/README.md does not name the RukenApp source commit')
  const tarballOf = new Map([...readme.matchAll(TABLE_ROW)].map((row) => [row[2], row[1]]))
  const hashOf = new Map([...readme.matchAll(HASH_LINE)].map((line) => [line[2], line[1]]))

  const rows = bundled.map((name) => {
    const tarball = tarballOf.get(name)
    if (tarball === undefined) throw new Error(`vendor/ruken/README.md does not vendor ${name}`)
    const hash = hashOf.get(tarball)
    if (hash === undefined) throw new Error(`vendor/ruken/README.md has no SHA-256 for ${tarball}`)
    const license = licenses.get(name)
    if (license === undefined) throw new Error(`${name}: its license is unknown, so no package may bundle it`)
    return `| \`${name}\` | \`${tarball}\` | \`${hash}\` | ${license.license} |`
  })

  return [
    '# Vendored Ruken code',
    '',
    `\`${packageName}\` bundles these Ruken packages into its \`dist/\`, because Ruken does not publish them yet`,
    '(AF decisions D-6 and D-8). They were packed from RukenApp at commit',
    `\`${commit}\`; the hashes are of the tarballs in automata-framework's \`vendor/ruken/\`.`,
    '',
    '| Package | Tarball | SHA-256 | License |',
    '|---|---|---|---|',
    ...rows,
    '',
    '## License',
    '',
    `The bundled Ruken code keeps its own licence, not \`${packageName}\`'s. Its text, from each package's`,
    '`LICENSE` file:',
    '',
    ...licenseSections(bundled, licenses),
  ].join('\n')
}

/**
 * The licence `<packageDir>/node_modules/<name>` declares: its package.json's `license` field and its LICENSE file.
 * Missing either fails the build, so a published package never bundles code without a licence (R-16).
 */
function installedLicense(packageDir: string, name: string): BundledLicense {
  const installed = join(packageDir, 'node_modules', name)
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as { license?: unknown }
  if (typeof manifest.license !== 'string')
    throw new Error(`${name}: the installed package declares no license, so no package may bundle it`)
  const file = readdirSync(installed).find((entry) => LICENSE_FILE.test(entry))
  if (file === undefined)
    throw new Error(`${name}: the installed package has no LICENSE file, so no package may bundle it`)
  return { license: manifest.license, text: readFileSync(join(installed, file), 'utf8') }
}

export interface WriteVendoredOptions {
  /** The repository root (where `vendor/ruken/README.md` is). */
  readonly root: string
  /** The package folder: `VENDORED.md` is written here, and the bundled packages are read from its node_modules. */
  readonly packageDir: string
  readonly packageName: string
  readonly bundled: readonly string[]
}

export function writeVendored(options: WriteVendoredOptions): void {
  const readme = readFileSync(join(options.root, 'vendor/ruken/README.md'), 'utf8')
  const licenses = new Map(options.bundled.map((name) => [name, installedLicense(options.packageDir, name)]))
  writeFileSync(
    join(options.packageDir, 'VENDORED.md'),
    vendoredNotice(readme, options.packageName, options.bundled, licenses),
  )
}
