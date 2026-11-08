// The live check, run after an upload: the host's answers must be the headers the site means to send, and a missing
// address must show the site's own page with status 404. It asks the host as a visitor would, so a rule the host reads
// differently from `_headers`' author shows up here and not in a reader's browser.
//   node scripts/check-deployed.ts <origin>
import { pathToFileURL } from 'node:url'
import { playgroundHeaders } from '../src/features/playground/headers.ts'
import { securityHeaders } from '../src/shared/html/security-headers.ts'
import { SITE_ORIGIN } from '../src/shared/site.js'

export interface Probe {
  readonly status: number
  readonly headers: Headers
  readonly body: string
}

/** One address of each kind the headers differ by: a page, a demo, the try-it editor, an example and a playground file. */
const PATHS = [
  '/',
  '/docs/how-it-works',
  '/demos/emberwick/',
  '/editor/app/',
  '/examples/shapes-rects',
  '/llms.txt',
]
const MISSING = '/no-such-page'

/** One message per path and header that is not as meant. The host's own extra headers are not judged. */
export async function deployedProblems(
  origin: string,
  fetcher: (url: string) => Promise<Probe>,
): Promise<string[]> {
  const problems: string[] = []
  for (const path of [...PATHS, MISSING]) {
    let probe: Probe
    try {
      probe = await fetcher(origin + path)
    } catch (error) {
      problems.push(
        `${path}: could not be fetched (${error instanceof Error ? error.message : String(error)})`,
      )
      continue
    }
    if (path === MISSING) {
      if (probe.status !== 404) problems.push(`${path}: answered ${probe.status}, not 404`)
      if (!probe.body.includes('Page not found'))
        problems.push(`${path}: the 404 answer is not the "Page not found" page`)
    } else if (probe.status !== 200) problems.push(`${path}: answered ${probe.status}, not 200`)
    for (const [name, value] of Object.entries({ ...securityHeaders(path), ...playgroundHeaders(path) })) {
      const got = probe.headers.get(name)
      if (got === null) problems.push(`${path}: ${name} is missing`)
      else if (got !== value) problems.push(`${path}: ${name} is ${got}, not ${value}`)
    }
  }
  return problems
}

const fetchProbe = async (url: string): Promise<Probe> => {
  const response = await fetch(url, { redirect: 'manual' })
  return { status: response.status, headers: response.headers, body: await response.text() }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const origin = (process.argv[2] ?? SITE_ORIGIN).replace(/\/$/, '')
  const problems = await deployedProblems(origin, fetchProbe)
  if (problems.length)
    throw new Error(`${origin} does not answer as the site means to:\n${problems.join('\n')}`)
  console.log(`${origin} answers with the site's headers, and its missing address shows the 404 page.`)
}
