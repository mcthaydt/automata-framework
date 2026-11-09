// GitHub for a journey, with no network: the site's sign-in function and the parts of GitHub's API the web editors call,
// answered inside the browser by Playwright's routes. One `FakeGitHub` is the shared truth (one account, one repository
// that two browsers read and write); each browser context that `install`s it gets its own sign-in, as two devices do.

import { createFakeGitHubRest, type FakeGitHubRest } from '@automata/editor/kit/testing/github'
import type { BrowserContext, Route } from '@playwright/test'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-github-api-version, if-none-match, accept',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'etag, link, retry-after',
}
const json = (body: unknown, status = 200) => ({
  status,
  headers: { 'content-type': 'application/json', ...CORS },
  body: JSON.stringify(body),
})

export interface FakeGitHub {
  /** The repository (`login/name`) the account will have. */
  readonly repo: string
  readonly rest: FakeGitHubRest
  /** The app has been let into the repository (the person chose it on GitHub's install page). */
  allowApp(): void
  /**
   * Answers the sign-in function and GitHub for one browser context. `siteUrl` is where sign-in comes back to. `device`
   * names the profile: the sign-in cookie lasts across closing and opening the browser, so the same device stays signed in.
   */
  install(context: BrowserContext, siteUrl: string, device?: string): Promise<void>
  /** Every address of github.com (not the API) a page opened in a new tab. */
  readonly opened: string[]
}

export function createFakeGitHub(options: { login: string; name: string }): FakeGitHub {
  const repo = `${options.login}/${options.name}`
  const rest = createFakeGitHubRest({ repo })
  let installed = false
  /** Devices holding a sign-in cookie. */
  const devices = new Set<string>()

  async function api(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (url.pathname === '/user') return route.fulfill(json({ login: options.login }))
    if (url.pathname === '/user/installations') return route.fulfill(json({ installations: [{ id: 1 }] }))
    if (url.pathname === '/user/installations/1/repositories')
      return route.fulfill(
        json({
          repositories: installed ? [{ full_name: repo, name: options.name, default_branch: 'main' }] : [],
        }),
      )
    if (url.pathname === `/repos/${repo}/contents/content/editors.toml` && request.method() === 'GET')
      return route.fulfill(json({}, rest.file('content/editors.toml') === undefined ? 404 : 200))
    if (!url.pathname.startsWith(`/repos/${repo}`)) return route.fulfill(json({ message: 'Not Found' }, 404))
    // A routed request is answered by the test, so the browser's own offline switch cannot cut it: the fake's `offline`
    // is what drops the connection.
    const answer = await rest
      .fetch(request.url(), {
        method: request.method(),
        headers: request.headers(),
        ...(request.postData() === null ? {} : { body: request.postData() as string }),
      })
      .catch(() => undefined)
    if (answer === undefined) return route.abort('internetdisconnected')
    const headers: Record<string, string> = { ...CORS }
    answer.headers.forEach((value, key) => {
      headers[key] = value
    })
    return route.fulfill({ status: answer.status, headers, body: await answer.text() })
  }

  const opened: string[] = []
  return {
    repo,
    rest,
    opened,
    allowApp: () => {
      installed = true
    },
    async install(context, siteUrl, device = `device-${String(devices.size)}`) {
      let signedIn = devices.has(device)
      let issued = 0
      await context.route('https://api.github.com/**', api)
      await context.route('https://github.com/**', (route) => {
        opened.push(route.request().url())
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>GitHub</p>' })
      })
      await context.route('**/api/github/**', (route) => {
        const url = new URL(route.request().url())
        const name = url.pathname.replace(/^.*\/api\/github\//, '')
        if (name === 'ping') return route.fulfill(json({ github: 'ready', app: 'automata' }))
        if (name === 'token') {
          if (!signedIn) return route.fulfill({ status: 401, headers: CORS })
          issued += 1
          return route.fulfill(
            json({ token: `ghu_${String(issued)}`, expiresAt: Date.now() + 8 * 3_600_000 }),
          )
        }
        if (name === 'sign-out') {
          signedIn = false
          devices.delete(device)
          return route.fulfill({ status: 204, headers: CORS })
        }
        if (name === 'start') {
          signedIn = true
          devices.add(device)
          const back = new URL(url.searchParams.get('back') ?? '/', 'http://editors.invalid')
          return route.fulfill({ status: 302, headers: { location: `${siteUrl}${back.search}` } })
        }
        return route.fulfill({ status: 404 })
      })
    },
  }
}
