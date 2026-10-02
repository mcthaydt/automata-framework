import { initRapier, run2d, run3d } from './scene'

const out: Record<string, unknown> = { ok: false }
try {
  await initRapier()
  const a = run3d(30)
  const b = run2d(30)
  // Review Focus #3: ok only if Rapier really stepped. Body 0 started at y=2 and must have fallen.
  const fell3 = (a.state[2] as number) < 2
  const fell2 = (b.state[2] as number) < 2
  Object.assign(out, { ok: fell3 && fell2, bodies3d: a.bodies, bodies2d: b.bodies })
} catch (err) {
  out.error = String(err)
}
;(window as unknown as { __result: unknown }).__result = out
