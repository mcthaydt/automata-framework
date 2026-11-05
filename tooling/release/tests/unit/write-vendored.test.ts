import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { vendoredNotice, writeVendored } from '#src/write-vendored.ts'

const README = `# Vendored Ruken packages

| Tarball | Package | Used by |
|---|---|---|
| \`ruken-sdk-0.0.0.tgz\` | \`@ruken/sdk\` | host |
| \`ruken-manifest-0.0.0.tgz\` | \`@ruken/manifest\` | ship |

**Source:** RukenApp \`main\` at \`b30d31b\`, packed 2026-10-11.

\`\`\`
8fb6f3b45972fe8e50be8e2501b5279d0ce27708b15af55c876fd1152be69474  ruken-sdk-0.0.0.tgz
4c47f29d73bfedcc220b6081e410c0acc37d7591323b9bbf8b6cd5eb9e9c369a  ruken-manifest-0.0.0.tgz
\`\`\`
`

const MIT_TEXT =
  'MIT License\n\nCopyright (c) 2026 Someone\n\nPermission is hereby granted, free of charge.\n'
const OTHER_TEXT = 'ISC License\n\nCopyright (c) 2026 Someone Else\n'
const BOTH_MIT = new Map([
  ['@ruken/sdk', { license: 'MIT', text: MIT_TEXT }],
  ['@ruken/manifest', { license: 'MIT', text: MIT_TEXT }],
])

const occurrences = (text: string, part: string): number => text.split(part).length - 1

describe('vendoredNotice', () => {
  it('names the RukenApp commit and each bundled package with its tarball, SHA-256 and licence', () => {
    const notice = vendoredNotice(README, '@mcthaydt/automata-host', ['@ruken/sdk'], BOTH_MIT)
    expect(notice).toContain('@mcthaydt/automata-host')
    expect(notice).toContain('`b30d31b`')
    expect(notice).toContain('| Package | Tarball | SHA-256 | License |')
    expect(notice).toContain(
      '| `@ruken/sdk` | `ruken-sdk-0.0.0.tgz` | `8fb6f3b45972fe8e50be8e2501b5279d0ce27708b15af55c876fd1152be69474` | MIT |',
    )
    expect(notice).not.toContain('@ruken/manifest')
  })

  it('lists several packages in the order given', () => {
    const notice = vendoredNotice(README, 'x', ['@ruken/manifest', '@ruken/sdk'], BOTH_MIT)
    expect(notice.indexOf('@ruken/manifest')).toBeLessThan(notice.indexOf('@ruken/sdk'))
  })

  it('carries the licence text once for the packages that share it, naming them', () => {
    const notice = vendoredNotice(README, 'x', ['@ruken/sdk', '@ruken/manifest'], BOTH_MIT)
    expect(notice).toContain('## License')
    expect(notice).toContain(`### \`@ruken/sdk\`, \`@ruken/manifest\`\n\n\`\`\`text\n${MIT_TEXT}\`\`\``)
    expect(occurrences(notice, MIT_TEXT)).toBe(1)
  })

  it('carries each different licence text under its own packages', () => {
    const licenses = new Map([
      ['@ruken/sdk', { license: 'MIT', text: MIT_TEXT }],
      ['@ruken/manifest', { license: 'ISC', text: OTHER_TEXT }],
    ])
    const notice = vendoredNotice(README, 'x', ['@ruken/sdk', '@ruken/manifest'], licenses)
    expect(notice).toContain(`### \`@ruken/sdk\`\n\n\`\`\`text\n${MIT_TEXT}\`\`\``)
    expect(notice).toContain(`### \`@ruken/manifest\`\n\n\`\`\`text\n${OTHER_TEXT}\`\`\``)
  })

  it('closes the code block on its own line when the licence text has no trailing newline', () => {
    const text = 'MIT License\n\nCopyright (c) 2026 Someone'
    const licenses = new Map([['@ruken/sdk', { license: 'MIT', text }]])
    const notice = vendoredNotice(README, 'x', ['@ruken/sdk'], licenses)
    expect(notice).toContain(`\`\`\`text\n${text}\n\`\`\`\n`)
  })

  it('refuses a package the README does not vendor', () => {
    expect(() => vendoredNotice(README, 'x', ['@ruken/cli'], BOTH_MIT)).toThrow(/@ruken\/cli/)
  })

  it('refuses a README without the source commit or a hash', () => {
    expect(() => vendoredNotice(README.replace('at `b30d31b`', ''), 'x', ['@ruken/sdk'], BOTH_MIT)).toThrow(
      /commit/,
    )
    expect(() => vendoredNotice(README.replace(/^8fb6.*$/m, ''), 'x', ['@ruken/sdk'], BOTH_MIT)).toThrow(
      /SHA-256/,
    )
  })

  it('refuses a bundled package whose licence is unknown', () => {
    expect(() => vendoredNotice(README, 'x', ['@ruken/sdk'], new Map())).toThrow(/@ruken\/sdk.*licen[cs]e/)
  })
})

describe('writeVendored', () => {
  const root = new URL('../../../..', import.meta.url).pathname

  /** A package folder whose node_modules holds `@ruken/sdk` with the given package.json and files. */
  const packageWithSdk = (manifest: object, files: Record<string, string>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'af-vendored-'))
    const installed = join(dir, 'node_modules', '@ruken', 'sdk')
    mkdirSync(installed, { recursive: true })
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ name: '@ruken/sdk', ...manifest }))
    for (const [name, text] of Object.entries(files)) writeFileSync(join(installed, name), text)
    return dir
  }

  it("writes VENDORED.md from the repository's vendor/ruken/README.md and the installed package's licence", () => {
    const dir = packageWithSdk({ license: 'MIT' }, { LICENSE: MIT_TEXT })
    writeVendored({ root, packageDir: dir, packageName: '@mcthaydt/automata-host', bundled: ['@ruken/sdk'] })
    const notice = readFileSync(join(dir, 'VENDORED.md'), 'utf8')
    expect(notice).toContain('ruken-sdk-0.0.0.tgz')
    expect(notice).toMatch(/\| `[0-9a-f]{64}` \| MIT \|/)
    expect(notice).toContain(MIT_TEXT)
  })

  it('refuses an installed package with no license field or no LICENSE file, so no build bundles it', () => {
    const write = (packageDir: string) =>
      writeVendored({ root, packageDir, packageName: 'x', bundled: ['@ruken/sdk'] })
    expect(() => write(packageWithSdk({}, { LICENSE: MIT_TEXT }))).toThrow(/@ruken\/sdk.*license/)
    expect(() => write(packageWithSdk({ license: 'MIT' }, {}))).toThrow(/@ruken\/sdk.*LICENSE/)
  })

  // Which file a directory listing gives first is up to the filesystem, so a package with two candidate licence
  // files would make the notice's text depend on the machine that built it. Refuse it rather than guess.
  it('refuses an installed package with more than one LICENSE file, naming them', () => {
    const dir = packageWithSdk({ license: 'MIT' }, { LICENSE: MIT_TEXT, 'LICENSE.md': OTHER_TEXT })
    expect(() => writeVendored({ root, packageDir: dir, packageName: 'x', bundled: ['@ruken/sdk'] })).toThrow(
      /@ruken\/sdk.*LICENSE, LICENSE\.md/,
    )
  })

  // The real tarballs, as host and ship install them: the four vendored packages carry the MIT licence the Owner
  // chose (2026-10-30, RukenApp #396), which every published package that bundles them repeats (PRODUCT.4r).
  it.each([
    ['packages/host', ['@ruken/sdk', '@ruken/sdk-host']],
    ['packages/ship', ['@ruken/manifest', '@ruken/cli']],
  ])('carries the MIT licence of the vendored tarballs %s bundles', (packagePath, bundled) => {
    const dir = mkdtempSync(join(tmpdir(), 'af-vendored-'))
    symlinkSync(join(root, packagePath, 'node_modules'), join(dir, 'node_modules'))
    writeVendored({ root, packageDir: dir, packageName: 'x', bundled })
    const notice = readFileSync(join(dir, 'VENDORED.md'), 'utf8')
    for (const name of bundled) expect(notice).toMatch(new RegExp(`\\| \`${name}\` \\|.*\\| MIT \\|`))
    expect(notice).toContain('MIT License')
    expect(notice).toContain('Permission is hereby granted, free of charge')
  })
})

// write-vendored copies the README's SHA-256 block into every published VENDORED.md, so the block must be the
// hashes of the tarballs actually in vendor/ruken/: a repack that forgets the README would otherwise publish
// wrong hashes and pass every other check.
describe('vendor/ruken/README.md', () => {
  const vendor = new URL('../../../../vendor/ruken/', import.meta.url).pathname

  it('lists the SHA-256 of exactly the tarballs in vendor/ruken/', () => {
    const readme = readFileSync(join(vendor, 'README.md'), 'utf8')
    const listed = Object.fromEntries(
      [...readme.matchAll(/^([0-9a-f]{64}) {2}([\w.-]+\.tgz)$/gm)].map(([, hash, tarball]) => [
        tarball,
        hash,
      ]),
    )
    const actual = Object.fromEntries(
      readdirSync(vendor)
        .filter((file) => file.endsWith('.tgz'))
        .map((tarball) => [
          tarball,
          createHash('sha256')
            .update(readFileSync(join(vendor, tarball)))
            .digest('hex'),
        ]),
    )
    expect(Object.keys(actual)).not.toHaveLength(0)
    expect(listed).toEqual(actual)
  })
})
