// The frame page's script in the feasibility proof (WEB.PLAY.1). It runs one scenario, named in the page's query,
// and posts one report to the parent. That it runs at all shows the frame's policy lets an opaque-origin document
// load the site's own module scripts ('self', R-2).
const violations = []
document.addEventListener('securitypolicyviolation', (event) => violations.push(event.effectiveDirective))

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
    return (await import('/bare/cache-probe.js')).default
  },
  async 'module-with-headers'() {
    return (await import('/playground/runtime/cache-probe.js')).default
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

async function run() {
  const scenario = new URL(location.href).searchParams.get('scenario') ?? ''
  const base = { scenario, origin: self.origin }
  try {
    const value = await scenarios[scenario]()
    // A violation event is queued as a task; give it one turn to arrive before reporting.
    await new Promise((resolve) => setTimeout(resolve, 50))
    parent.postMessage({ ...base, ok: true, value, violations }, location.origin)
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    parent.postMessage({ ...base, ok: false, error: String(error), violations }, location.origin)
  }
}
run()
