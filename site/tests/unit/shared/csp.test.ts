// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CSP_META_PREFIX, withContentSecurityPolicy } from '#src/shared/html/csp.ts'
import { finishPage } from '#src/shared/html/finish-page.ts'

// QB.4a: the pages' Content-Security-Policy, without `unsafe-inline` for scripts. Every inline
// script is allowed by its own hash, computed from the final HTML, after QB.3j's hydration rewrite.

const START = '<script>\n\t\t\t\t{ console.log("start") }\n\t\t\t</script>'
const page = (head: string, body: string) =>
  `<!doctype html><html lang="en"><head>\n\t\t<meta charset="utf-8" />${head}</head><body>${body}</body></html>`
const hash = (script: string) => `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
const policyOf = (html: string) =>
  /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1] ?? ''
const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? ''

describe('withContentSecurityPolicy', () => {
  it('puts the policy first in <head>, before anything the browser could run or fetch', () => {
    const html = withContentSecurityPolicy(page('<link rel="stylesheet" href="/a.css">', START))
    expect(html.indexOf(CSP_META_PREFIX)).toBeGreaterThan(html.indexOf('<head>'))
    expect(html.indexOf(CSP_META_PREFIX)).toBeLessThan(html.indexOf('<meta charset'))
  })

  it('allows each inline script by its sha256, and never unsafe-inline or unsafe-eval for scripts', () => {
    const second = '<script type="module">import("/x.js")</script>'
    const script = directive(policyOf(withContentSecurityPolicy(page('', START + second))), 'script-src')
    expect(script).toBe(`script-src 'self' ${hash(START.slice(8, -9))} ${hash('import("/x.js")')}`)
    expect(script).not.toMatch(/unsafe/)
  })

  it('hashes what the browser runs: CRLF read as LF, any letter case, a space before the closing >', () => {
    const script = directive(
      policyOf(withContentSecurityPolicy(page('', '<SCRIPT>a()\r\nb()</script >'))),
      'script-src',
    )
    expect(script).toBe(`script-src 'self' ${hash('a()\nb()')}`)
  })

  it('does not hash a script loaded from a file', () => {
    const script = directive(
      policyOf(withContentSecurityPolicy(page('<script type="module" src="/a.js"></script>', ''))),
      'script-src',
    )
    expect(script).toBe("script-src 'self'")
  })

  it('keeps everything else to the site’s own origin', () => {
    const policy = policyOf(withContentSecurityPolicy(page('', START)))
    expect(policy.split('; ').filter((part) => !part.startsWith('script-src'))).toEqual([
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ])
  })
})

describe('finishPage', () => {
  it('hashes the start script as the hydration rewrite left it', () => {
    const sveltekitStart = `<script>\n\t\t\t\t{\n\t\t\t\t\tPromise.all([\n\t\t\t\t\t\timport("./_app/immutable/entry/start.js"),\n\t\t\t\t\t\timport("./_app/immutable/entry/app.js")\n\t\t\t\t\t]).then(([kit, app]) => {\n\t\t\t\t\t\tkit.start(app, element, {});\n\t\t\t\t\t});\n\t\t\t\t}\n\t\t\t</script>`
    const html = finishPage(page('', `<div style="display: contents">${sveltekitStart}</div>`))
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!
    expect(script).toContain('afterFirstPaint')
    expect(directive(policyOf(html), 'script-src')).toBe(`script-src 'self' ${hash(script)}`)
  })
})
