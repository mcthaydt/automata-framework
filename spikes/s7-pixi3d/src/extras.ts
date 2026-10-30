// S7-g: a page that imports @pixi/3d/extras. Its particle code probes `new Function` when the module loads
// (`unsafeEvalSupported()` in extras/particles/utils/generateSpawnBurst.mjs), which Ruken's CSP blocks: the page
// should record a securitypolicyviolation even with no-eval imported first. render-pixi3d never imports extras.
import '@mcthaydt/automata-render-pixi/no-eval'
import { ParticleSystem3D } from '@pixi/3d/extras'

const report = { ready: false, extrasLoaded: typeof ParticleSystem3D === 'function', errors: [] as string[] }
;(window as unknown as { __s7: typeof report }).__s7 = report
window.addEventListener('error', (event) => report.errors.push(String(event.message)))
report.ready = true
