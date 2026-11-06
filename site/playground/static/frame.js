// The frame page's script in the feasibility proof (WEB.PLAY.1). It runs one scenario, named in the page's query,
// and posts one report to the parent. That it runs at all shows the frame's policy lets an opaque-origin document
// load the site's own module scripts ('self', R-2).
const violations = []
let violationSeen
const firstViolation = new Promise((resolve) => {
  violationSeen = resolve
})
document.addEventListener('securitypolicyviolation', (event) => {
  violations.push(event.effectiveDirective)
  violationSeen()
})

// A case that expects the policy to refuse a request waits for the violation event before it reports, bounded so a
// missing event fails the case instead of hanging it. WebKit fires no event for eval, so only fetch waits.
const WAITS_FOR_VIOLATION = new Set(['fetch-other-origin'])
const VIOLATION_WAIT_MS = 2000

const query = new URL(location.href).searchParams
// Each R-1 measurement asks for its own copy of the module, so another engine's run cannot change its count.
const run = query.get('run') ?? ''

const scenarios = {
  // R-3: the reader's compiled code arrives as text; a Blob module's bare import resolves through the import map.
  async 'blob-zod'() {
    const code = "import { z } from 'zod'\nexport default z.string().parse('parsed by zod')\n"
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    return (await import(url)).default
  },
  async eval() {
    // biome-ignore lint/security/noGlobalEval: the point of the case is that the policy refuses eval
    return globalThis.eval('1 + 1')
  },
  async 'fetch-other-origin'() {
    const response = await fetch('https://example.com/')
    return response.status
  },
  async 'fetch-self'() {
    return (await fetch('/playground/runtime/probe.txt')).text()
  },
  // §11.3: the same module, without and then with the headers.
  async 'bare-module'() {
    return (await import(`/bare/cache-probe.js?run=${run}`)).default
  },
  async 'module-with-headers'() {
    return (await import(`/playground/runtime/cache-probe.js?run=${run}`)).default
  },
  // Pixi loads textures and sounds with fetch and image elements; each must reach the site.
  async 'image-self'() {
    const image = new Image()
    image.src = '/playground/runtime/probe.svg'
    await image.decode()
    return image.naturalWidth
  },
  async 'image-self-cors'() {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = '/playground/runtime/probe.svg'
    await image.decode()
    return image.naturalWidth
  },
  async storage() {
    return localStorage.length
  },
  async 'parent-document'() {
    return parent.document.title
  },
}

async function report() {
  const scenario = query.get('scenario') ?? ''
  const base = { scenario, origin: self.origin }
  const body = scenarios[scenario]
  let outcome
  try {
    if (body === undefined) throw new Error(`unknown scenario ${scenario}`)
    outcome = { ok: true, value: await body() }
  } catch (error) {
    outcome = { ok: false, error: String(error) }
  }
  if (WAITS_FOR_VIOLATION.has(scenario))
    await Promise.race([firstViolation, new Promise((resolve) => setTimeout(resolve, VIOLATION_WAIT_MS))])
  parent.postMessage({ ...base, ...outcome, violations }, location.origin)
}
report()
