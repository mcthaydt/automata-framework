// The deploy's own check, run before the site goes to its host (`.github/workflows/site.yml`): the site's contact and
// security addresses must be the project's, not a person's mailbox. The addresses come from site.js, the one
// place the footer, Privacy, Terms and security.txt take them from. Until the Owner names the project's address, this
// fails, so nothing deploys with a personal mailbox on every page.
import { pathToFileURL } from 'node:url'
import { CONTACT_EMAIL, SECURITY_EMAIL } from '../src/shared/site.js'

// Mail services that hand out personal mailboxes. A project address lives on the project's own domain.
const PERSONAL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
])

/** One sentence per address that is a personal mailbox; an empty list means the site can launch. */
export function launchProblems(addresses: { contact: string; security: string }): string[] {
  return Object.entries(addresses)
    .filter(([, address]) => PERSONAL_DOMAINS.has(address.split('@').pop()!.toLowerCase()))
    .map(
      ([role, address]) =>
        `The ${role} address ${address} is a personal mailbox; the site needs the project’s own address.`,
    )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const problems = launchProblems({ contact: CONTACT_EMAIL, security: SECURITY_EMAIL })
  if (problems.length) throw new Error(problems.join('\n'))
  console.log('The site’s addresses are the project’s own.')
}
