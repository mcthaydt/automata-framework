// The deploy's own check, run before the site goes to its host (`.github/workflows/site.yml`): the site's contact and
// security addresses must be the project's, not a person's mailbox. The addresses come from site.js, the one
// place the footer, Privacy, Terms and security.txt take them from. Until the Owner names the project's address, this
// fails, so nothing deploys with a personal mailbox on every page. It also fails while the package the site's first
// command installs is not on npmjs.org, so the command a visitor copies always finds a package. It waits for Pixi 3D to
// be public (its terms allow no public deployment before), for the framework's repository to be open (the site links
// to it) and for the domain to have a mail record (the contact address is on every page).
import { resolveMx } from 'node:dns/promises'
import { pathToFileURL } from 'node:url'
import { CREATE_COMMAND } from '../src/features/home/home-content.ts'
import { CONTACT_EMAIL, REPOSITORY_PUBLIC, SECURITY_EMAIL, SITE_ORIGIN } from '../src/shared/site.js'

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

/** Whether npmjs.org has the package at all (any version); the packages are public, so no token is needed. */
export type OnRegistry = (name: string) => Promise<boolean>

/**
 * One sentence per package the site sends a visitor to that is not on the registry, or that could not be asked about.
 * The `@automata` scope on npmjs.org belongs to another account until the rename to `@automataframework` lands, so until
 * then a package of theirs with this name would pass; the runbook makes the rename the first step of the launch.
 */
export async function unpublishedProblems(
  names: readonly string[],
  onRegistry: OnRegistry,
): Promise<string[]> {
  const problems: string[] = []
  for (const name of names) {
    try {
      if (!(await onRegistry(name))) {
        problems.push(
          `${name} is not on npmjs.org yet, so the site’s first command (npx @automata/tools create-game) would fetch nothing.`,
        )
      }
    } catch (error) {
      problems.push(
        `Could not ask npmjs.org about ${name} (${error instanceof Error ? error.message : String(error)}).`,
      )
    }
  }
  return problems
}

/** The package the Home command installs (`npx <package> create-game …`), read from the page's own words. */
export function installedPackage(): string {
  const name = /^npx (@[a-z0-9-]+\/[a-z0-9-]+)/.exec(CREATE_COMMAND)?.[1]
  if (!name) throw new Error(`The Home command does not start with npx and a package: ${CREATE_COMMAND}`)
  return name
}

/** Pixi 3D's terms allow no public deployment until it is published, so the launch waits for it. */
export async function pixiPublicProblems(onRegistry: OnRegistry): Promise<string[]> {
  try {
    if (await onRegistry('@pixi/3d')) return []
  } catch (error) {
    return [
      `Could not ask npmjs.org about @pixi/3d (${error instanceof Error ? error.message : String(error)}).`,
    ]
  }
  return ['Pixi 3D is not public yet. Automata launches the day it is.']
}

/** The site links to the framework's repository once it is public; until then no page may. */
export function repositoryProblems(isPublic: boolean): string[] {
  return isPublic
    ? []
    : [
        'The framework’s repository is still private. Open it on launch day, then set REPOSITORY_PUBLIC in site.js.',
      ]
}

/** The contact address is on every page, so its domain must have somewhere to deliver mail. */
export async function mailboxProblems(
  domain: string,
  lookup: (domain: string) => Promise<unknown[]>,
): Promise<string[]> {
  try {
    if ((await lookup(domain)).length > 0) return []
  } catch (error) {
    // ENODATA (the name resolves and has no MX) and ENOTFOUND (the name does not resolve) both mean there is nowhere to
    // deliver mail, which is the finding itself and not a failure to look.
    const code = (error as { code?: unknown } | null)?.code
    if (code === 'ENODATA' || code === 'ENOTFOUND') return [noMailRecord(domain)]
    return [
      `Could not look up the mail record for ${domain} (${error instanceof Error ? error.message : String(error)}).`,
    ]
  }
  return [noMailRecord(domain)]
}

const noMailRecord = (domain: string): string =>
  `${domain} has no mail record, so mail to hello@${domain} would bounce.`

const askNpm: OnRegistry = async (name) => {
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`, { method: 'HEAD' })
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return true
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const problems = [
    ...launchProblems({ contact: CONTACT_EMAIL, security: SECURITY_EMAIL }),
    ...(await unpublishedProblems([installedPackage()], askNpm)),
    ...(await pixiPublicProblems(askNpm)),
    ...repositoryProblems(REPOSITORY_PUBLIC),
    ...(await mailboxProblems(new URL(SITE_ORIGIN).hostname, resolveMx)),
  ]
  if (problems.length) throw new Error(problems.join('\n'))
  console.log(
    'The site can launch: its addresses are the project’s own and have a mailbox, its first command installs, Pixi 3D and the repository are public.',
  )
}
