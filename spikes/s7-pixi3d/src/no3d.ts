// S7-Q7's baseline: main.ts's mount (no-eval, render-pixi's createPixiRenderer, the delta consumer, Effect)
// without @pixi/3d or the figure code, so the byte difference is what the 3D scene adds.
import '@mcthaydt/automata-render-pixi/no-eval'
import { RenderDeltaConsumer } from '@mcthaydt/automata-render-pixi/delta'
import { createPixiRenderer } from '@mcthaydt/automata-render-pixi/renderer'
import { Effect, Scope } from 'effect'
import { Graphics } from 'pixi.js'
import { windowTarget } from './mount/target.ts'

const report = { ready: false, renderer: '', frames: 0, errors: [] as string[] }
;(window as unknown as { __s7: typeof report }).__s7 = report

async function main(): Promise<void> {
  const factory = createPixiRenderer({
    backgroundColor: 0x2e222f,
    pixelArt: false,
    setup(stage) {
      const consumer = new RenderDeltaConsumer(stage.world)
      stage.world.addChild(new Graphics().rect(40, 40, 120, 80).fill(0x249fde))
      return { apply: (result) => consumer.apply(result.render) }
    },
  })
  const scope = Effect.runSync(Scope.make())
  const renderer = await Effect.runPromise(
    Scope.extend(factory(windowTarget(document.getElementById('game')!)), scope),
  )
  report.renderer = renderer.stage.app.renderer.name
  const frame = () => {
    renderer.draw({ alpha: 1, frameMs: 16, paused: false })
    report.frames++
    if (report.frames >= 30) report.ready = true
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

window.addEventListener('error', (event) => report.errors.push(String(event.message)))
main().catch((error: unknown) => report.errors.push(String(error)))
