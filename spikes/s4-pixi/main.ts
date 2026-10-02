import { autoDetectRenderer, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { gpuInfo } from '../shared/gpu-info'
import { mulberry32 } from '../shared/prng'
import { ditherFilter } from './dither'

const params = new URLSearchParams(location.search)
const requested = params.get('backend') === 'webgl' ? 'webgl' : 'webgpu'
const dither = params.get('dither') !== '0' // ?dither=0 renders the plain frame (positive control)
const renderer = await autoDetectRenderer({
  preference: requested,
  width: 480,
  height: 270,
  background: 0x202040,
  antialias: false,
  resolution: 1,
})
document.body.appendChild(renderer.canvas)
const backend = renderer.name === 'webgpu' ? 'webgpu' : 'webgl'

const rand = mulberry32(11)
const stress = new Container()
const sprites = Array.from({ length: 5000 }, () => {
  const s = new Sprite(Texture.WHITE)
  s.tint = Math.floor(rand() * 0xffffff)
  s.width = 4
  s.height = 4
  s.position.set(rand() * 480, rand() * 270)
  stress.addChild(s)
  return s
})
const frames = 300
let n = 0
const t0 = performance.now()
await new Promise<void>((done) => {
  const frame = () => {
    for (const s of sprites) s.x = (s.x + 1) % 480
    renderer.render(stress)
    n += 1
    if (n < frames) requestAnimationFrame(frame)
    else done()
  }
  requestAnimationFrame(frame)
})
const fps5k = frames / ((performance.now() - t0) / 1000)

// Static frame for the screenshot comparison: 16 gradient bars, optionally through the dither filter.
const scene = new Container()
for (let i = 0; i < 16; i++) {
  const color = ((i * 16) << 16) | ((255 - i * 16) << 8) | 128
  scene.addChild(new Graphics().rect(i * 30, 0, 30, 270).fill({ color }))
}
if (dither) scene.filters = [ditherFilter(8)]
renderer.render(scene)
await new Promise((r) => requestAnimationFrame(() => r(null)))
;(window as unknown as { __result: unknown }).__result = {
  ok: backend === requested,
  requested,
  backend,
  dither,
  fps5k: Math.round(fps5k),
  gpu: await gpuInfo(),
}
