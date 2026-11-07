// The pages the lean site cut (spec 10.2), and where each old address now leads. A visitor or a search result that
// still holds an old link lands on the page that took its place, never on the 404.
//
// The site is static and its host is not chosen yet (D8), so a redirect is a small page of its own rather than a
// host rule: a meta refresh moves the browser at once, and the link is there for a reader whose browser does not.
// `scripts/write-redirects.ts` writes one per address after the build; `noindex` keeps them out of search results,
// and the sitemap and the page checks skip them (`scripts/site-checks.ts`, `builtPages`).

/** Old address → the page that took its place. */
export const REDIRECTS: Readonly<Record<string, string>> = {
  '/ai': '/docs/how-it-works',
  '/inside': '/docs/how-it-works',
  '/cheatsheet': '/api',
  '/showcase': '/',
  '/community': '/',
  '/proof': '/',
  '/releases': '/',
  '/sources': '/',
}

/** The file a static host serves for an old address: `/ai` is `ai.html`, as SvelteKit writes its own pages. */
export function redirectFile(from: string): string {
  return from.slice(1) + '.html'
}

/** The whole page for one redirect. It holds no script, so it passes any Content-Security-Policy. */
export function redirectPage(to: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${to}">
<title>This page has moved</title>
</head>
<body>
<p>This page has moved. <a href="${to}">Go to the new page</a>.</p>
</body>
</html>
`
}
