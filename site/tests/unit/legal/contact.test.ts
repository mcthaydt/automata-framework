// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { launchProblems } from '../../../scripts/check-launch'
import { SECURITY_EMAIL } from '../../../src/shared/site.js'

// W9: the site shows one contact address and one security address, both from site.js; the launch refuses a personal
// mailbox for either. Until the Owner names the project's address (D8) the launch check fails, and the deploy with it.
describe('the contact addresses', () => {
  it('security.txt lists the address site.js names, so the two cannot drift', () => {
    const securityTxt = readFileSync(
      resolve(import.meta.dirname, '../../../static/.well-known/security.txt'),
      'utf8',
    )
    expect(securityTxt).toContain(`Contact: mailto:${SECURITY_EMAIL}\n`)
  })

  it('a launch refuses a personal mailbox, naming which address and why', () => {
    expect(launchProblems({ contact: 'someone@gmail.com', security: 'security@example.com' })).toEqual([
      'The contact address someone@gmail.com is a personal mailbox; the site needs the project’s own address.',
    ])
    expect(launchProblems({ contact: 'hello@example.com', security: 'me@icloud.com' })).toHaveLength(1)
    expect(launchProblems({ contact: 'a@Outlook.com', security: 'b@proton.me' })).toHaveLength(2)
  })

  it('a launch takes the project’s own addresses', () => {
    expect(
      launchProblems({ contact: 'hello@automataframework.com', security: 'security@automataframework.com' }),
    ).toEqual([])
  })
})
