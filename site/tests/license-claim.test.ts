// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The site says the framework code is MIT licensed (Footer, home page, terms, FAQ). This test holds that claim to the
// framework's own published metadata, read from the sibling checkout like tests/api-contract.test.ts does.
const framework = resolve('../automata-framework')

function publishedLicenses(): Record<string, string> {
  const licenses: Record<string, string> = {}
  for (const name of readdirSync(join(framework, 'packages')).sort()) {
    const manifestPath = join(framework, 'packages', name, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name: string; private?: boolean; license?: string }
    if (manifest.private) continue
    licenses[manifest.name] = manifest.license ?? '(none)'
  }
  return licenses
}

describe('the MIT claim on the site', () => {
  it('reads published framework packages', () => {
    expect(Object.keys(publishedLicenses()).length).toBeGreaterThan(0)
  })

  // EXPECTED RED UNTIL DX.11 (quality-bar spec F-1). Today every framework package says "UNLICENSED" and there is no
  // LICENSE file, so the claim is false and this assertion fails. `it.fails` records that: the suite stays green while
  // the assertion fails, and turns red the moment the framework becomes MIT, which forces whoever lands DX.11 to
  // delete `.fails` here and make this a normal, hard-failing test. Do not delete the test or the site's MIT copy.
  it.fails('every published framework package declares MIT and the framework ships the MIT text (expected red until DX.11)', () => {
    const licenses = publishedLicenses()
    expect(licenses).toEqual(Object.fromEntries(Object.keys(licenses).map(name => [name, 'MIT'])))
    const licenseFile = join(framework, 'LICENSE')
    expect(existsSync(licenseFile), 'framework LICENSE file').toBe(true)
    expect(readFileSync(licenseFile, 'utf8')).toMatch(/^MIT License/)
  })
})
