// Cloudflare Pages Function for /api/github/*: all it does is hand the request to `handleGitHub`. Its settings are the
// project's own (variables `GITHUB_CLIENT_ID` and `GITHUB_APP_SLUG`; secrets `GITHUB_CLIENT_SECRET` and `COOKIE_KEY`).
import { handleGitHub } from '../../../src/features/sign-in/server/github-routes'

interface Env {
  GITHUB_CLIENT_ID?: string
  GITHUB_APP_SLUG?: string
  GITHUB_CLIENT_SECRET?: string
  COOKIE_KEY?: string
  /** Optional: the site's one public origin; without it, the request's own. */
  SITE_ORIGIN?: string
}

export const onRequest = (context: { request: Request; env: Env }): Promise<Response> =>
  handleGitHub(
    context.request,
    { ...context.env, SITE_ORIGIN: context.env.SITE_ORIGIN ?? new URL(context.request.url).origin },
    {
      fetch: (input, init) => fetch(input, init),
      now: () => Date.now(),
      random: (n) => crypto.getRandomValues(new Uint8Array(n)),
    },
  )
