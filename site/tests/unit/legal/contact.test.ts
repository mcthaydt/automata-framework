// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTACT_EMAIL, SECURITY_EMAIL, SITE_ORIGIN } from '../../../src/shared/site.js'

// W9: the site's contact addresses are the project's own, on its own domain, never one person's mailbox. The footer,
// Privacy, Terms and security.txt all read them from site.js, so holding that file and security.txt holds every page.
const site = resolve(import.meta.dirname, '../../..')
const domain = new URL(SITE_ORIGIN).hostname
const PERSONAL_MAILBOX = /@(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton|protonmail)\.[a-z.]+/i

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(svelte|ts|js|txt|md|html)$/.test(entry.name) ? [path] : []
  })
}

describe('the contact addresses', () => {
  it('are on the site’s own domain', () => {
    expect(CONTACT_EMAIL).toMatch(new RegExp(`^[a-z]+@${domain.replace('.', '\\.')}$`))
    expect(SECURITY_EMAIL).toMatch(new RegExp(`^[a-z]+@${domain.replace('.', '\\.')}$`))
  })

  it('are what security.txt lists', () => {
    const securityTxt = readFileSync(join(site, 'static/.well-known/security.txt'), 'utf8')
    expect(securityTxt).toContain(`Contact: mailto:${SECURITY_EMAIL}\n`)
  })

  it('leave no personal mailbox in any page source or static file', () => {
    const found = [...sourceFiles(join(site, 'src')), ...sourceFiles(join(site, 'static'))].filter((file) =>
      PERSONAL_MAILBOX.test(readFileSync(file, 'utf8')),
    )
    expect(found).toEqual([])
  })
})
