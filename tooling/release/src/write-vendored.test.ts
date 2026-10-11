import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { vendoredNotice, writeVendored } from './write-vendored.ts'

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

describe('vendoredNotice', () => {
  it('names the RukenApp commit and each bundled package with its tarball and SHA-256', () => {
    const notice = vendoredNotice(README, '@mcthaydt/automata-host', ['@ruken/sdk'])
    expect(notice).toContain('@mcthaydt/automata-host')
    expect(notice).toContain('`b30d31b`')
    expect(notice).toContain(
      '| `@ruken/sdk` | `ruken-sdk-0.0.0.tgz` | `8fb6f3b45972fe8e50be8e2501b5279d0ce27708b15af55c876fd1152be69474` |',
    )
    expect(notice).not.toContain('@ruken/manifest')
  })

  it('lists several packages in the order given', () => {
    const notice = vendoredNotice(README, 'x', ['@ruken/manifest', '@ruken/sdk'])
    expect(notice.indexOf('@ruken/manifest')).toBeLessThan(notice.indexOf('@ruken/sdk'))
  })

  it('refuses a package the README does not vendor', () => {
    expect(() => vendoredNotice(README, 'x', ['@ruken/cli'])).toThrow(/@ruken\/cli/)
  })

  it('refuses a README without the source commit or a hash', () => {
    expect(() => vendoredNotice(README.replace('at `b30d31b`', ''), 'x', ['@ruken/sdk'])).toThrow(/commit/)
    expect(() => vendoredNotice(README.replace(/^8fb6.*$/m, ''), 'x', ['@ruken/sdk'])).toThrow(/SHA-256/)
  })
})

describe('writeVendored', () => {
  it("writes VENDORED.md into the package folder from the repository's vendor/ruken/README.md", () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-vendored-'))
    const root = new URL('../../..', import.meta.url).pathname
    writeVendored({ root, packageDir: dir, packageName: '@mcthaydt/automata-host', bundled: ['@ruken/sdk'] })
    expect(readFileSync(join(dir, 'VENDORED.md'), 'utf8')).toContain('ruken-sdk-0.0.0.tgz')
  })
})
