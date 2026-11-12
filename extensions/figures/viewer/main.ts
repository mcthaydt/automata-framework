// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 27 of the builders-fold plan (the strict flags) replaces each with a check
/**
 * The figure viewer: the base pair in a Pixi 3D scene, each the painter's own cell on a quad (src/view.ts). Not part of
 * the base's public surface; `npm run viewer` serves it.
 *
 *   /               The Last Light's gameplay camera (src/shared/stage/pose.ts `gameplay`: perspective, 30° down, 16 m),
 *                   a 640×480 frame shown at the largest whole multiple the window holds, the base pair drawn through
 *                   `stageFrame` and `StageView` at density 2, painted at the renders' 18°. Q and R step the orbit by 45°, W walks, C toggles crisp
 *                   figures (on by default, the owner's call at the c6 visual gate: whole pixels a texel, on the pixel
 *                   grid; off, a figure is true to scale), `?crisp=off` starts with it off, `?frame=2` makes the frame
 *                   1280×960 (a host's bigger frame: the same view, a longer focal length).
 *   /?free          the free orbit camera, a debugging aid: drag to orbit, wheel to zoom, W to walk, ←/→ to turn the
 *                   figures; `?az=&pitch=&dist=&facing=` (degrees, metres) start the camera and the figures there,
 *                   `&walk` walking
 *   /?case=NAME     one named check frame (viewer/cases.ts) drawn through `StageView` on a canvas of its pose's size;
 *                   `&twice` draws it a second time from a rebuilt frame. What `scripts/view-check.ts` compares with
 *                   `compose`. It sets `document.body.dataset.ready` once drawn.
 *   /?check=D       one base figure in view D of the 8 (and `&who=1` for base-f) under an orthographic camera at the
 *                   sheets' 18°, one texel to one pixel, on a 128 × 192 canvas: what `scripts/view-check.ts` compares
 *                   with the sheets' cell, texel for texel. It sets `document.body.dataset.ready` once drawn.
 */
import '@pixi/3d'
import { CubeGeometry, FlatMaterial, Mesh3D, PlaneGeometry, View3D } from '@pixi/3d'
import { Application, BufferImageSource, Texture } from 'pixi.js'
import { type ActorScript, BASE, gameplay, member, ScriptedActor, stageFrame, type V3 } from '../src/entries'
import { FigureSprite, StageView } from '../src/entries/view'
import { CASES } from './cases'

const params = new URLSearchParams(location.search)
const deg = Math.PI / 180
const DENSITY = 2
const help = (text: string) => {
  const el = document.getElementById('help')
  if (el) el.textContent = text
}
/** `?renderer=webgpu` draws through Pixi's WebGPU renderer (view-check runs every case under both); WebGL is the default. */
const preference = params.get('renderer') === 'webgpu' ? 'webgpu' : 'webgl'
/** The canvas as presented, copied in the task that drew it: a WebGPU canvas keeps no drawing buffer past that task. */
const present = (app: Application) => {
  const c = app.canvas as HTMLCanvasElement,
    copy = document.createElement('canvas')
  copy.width = c.width
  copy.height = c.height
  const g = copy.getContext('2d')!
  g.drawImage(c, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  let bin = ''
  for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode(...d.subarray(i, i + 0x8000))
  ;(window as unknown as { __frame?: { w: number; h: number; b64: string } }).__frame = {
    w: c.width,
    h: c.height,
    b64: btoa(bin),
  }
}
const settle = (app: Application) => {
  app.render()
  requestAnimationFrame(() => {
    app.render()
    if (preference === 'webgpu') present(app)
    document.body.dataset.ready = 'true'
  })
}
/** A transparent, unsmoothed canvas that keeps its drawing buffer, so it can be read back. */
const startApp = async (w: number, h: number, background?: number) => {
  const app = new Application()
  await app.init({
    width: w,
    height: h,
    background,
    backgroundAlpha: background === undefined ? 0 : 1,
    preference,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    preserveDrawingBuffer: true,
  })
  document.body.appendChild(app.canvas)
  return app
}

/** `?case=NAME`: a named stage frame, drawn through StageView (the GPU side of view-check's comparison). */
async function caseMain(name: string) {
  const c = CASES[name]
  if (!c) throw new Error(`no case ${name}`)
  let frame = c.frame()
  const [w, h] = frame.camera.size,
    app = await startApp(w, h),
    stage = new StageView([w, h], c.range)
  app.stage.addChild(stage.view)
  if (c.wall) {
    // the case's wall, in the scene beside the figures: a plane facing +z, one colour through the same texture path as a cell
    const { z, x, y, rgba } = c.wall,
      source = new BufferImageSource({
        resource: new Uint8Array(rgba),
        width: 1,
        height: 1,
        format: 'rgba8unorm',
        scaleMode: 'nearest',
        alphaMode: 'no-premultiply-alpha',
      })
    const mesh = new Mesh3D({
      geometry: new PlaneGeometry({ width: x[1] - x[0], height: y[1] - y[0] }),
      material: new FlatMaterial({ baseColorTexture: new Texture({ source }) }),
    })
    mesh.position.set((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, z)
    stage.view.root.addChild(mesh)
  }
  stage.draw(frame)
  app.render()
  document.body.dataset.renderer = app.renderer.name // view-check asserts a WebGPU page really got WebGPU
  document.body.dataset.perTexelDepth = String(stage.perTexelDepth) // view-check asserts the first render found WebGL
  if (params.has('twice')) {
    frame = c.frame()
    stage.draw(frame)
  }
  settle(app)
}

/** `?check=D`: one figure, as the sheets draw it, under an orthographic camera (view-check's standing views). */
async function checkMain(check: string) {
  const cast = member(BASE[Number(params.get('who') ?? 0)].def, DENSITY),
    [cw, ch] = cast.cell,
    ppm = ch / cast.metres
  const app = await startApp(cw, ch),
    view = new View3D({ width: cw, height: ch, toneMapping: 'none' })
  app.stage.addChild(view)
  // One figure, as the sheets draw it: facing view D, the camera on +z at 18°, orthographic, a texel a pixel.
  const fig = new FigureSprite(cast)
  view.root.addChild(fig.sprite)
  const pitch = 18 * deg,
    aim = (ch / 2 - cast.feet) / ppm / Math.cos(pitch)
  const target: V3 = [0, aim, 0],
    eye: V3 = [0, aim + 20 * Math.sin(pitch), 20 * Math.cos(pitch)]
  view.camera.mode = 'orthographic'
  view.camera.orthographicSize = cw / 2 / ppm
  view.camera.position.set(...eye)
  view.camera.lookAt({ x: target[0], y: target[1], z: target[2] })
  for (let i = 0; i < 3; i++)
    fig.update(1 / 60, { facing: (Number(check) * Math.PI) / 4, moving: false, eye, target })
  settle(app)
}

/** `/`: The Last Light's gameplay camera on the base pair, crisp figures by default, true scale to compare. */
async function gameplayMain() {
  const k0 = Number(params.get('frame') ?? 1),
    [w, h] = [640 * k0, 480 * k0],
    app = await startApp(w, h, 0x31222a),
    stage = new StageView([w, h])
  app.stage.addChild(stage.view)
  // Shown at the largest whole multiple of 640×480 the window holds, each pixel a square.
  const fit = () => {
    const k = Math.max(1, Math.floor(Math.min(innerWidth / w, innerHeight / h)))
    app.canvas.style.cssText = `width:${w * k}px;height:${h * k}px;image-rendering:pixelated;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%)`
  }
  fit()
  addEventListener('resize', fit)
  // The pair stand at x = ∓0.6, or walk back and forth along z (W).
  const stand = (): ScriptedActor[] =>
    BASE.map((b, i) => new ScriptedActor({ who: b.def.id, at: [i === 0 ? -0.6 : 0.6, 0] }))
  const lap = (x: number): ActorScript['path'] =>
    Array.from({ length: 40 }, (_, i) => ({ at: [x, i % 2 ? 1.5 : -1.5] as [number, number] }))
  const walk = (): ScriptedActor[] =>
    BASE.map(
      (b, i) =>
        new ScriptedActor({
          who: b.def.id,
          at: [i === 0 ? -0.6 : 0.6, -1.5],
          path: lap(i === 0 ? -0.6 : 0.6),
        }),
    )
  let actors = stand(),
    walking = false,
    crisp = params.get('crisp') !== 'off',
    orbit = 0,
    t = 0
  const label = () =>
    help(
      `Q/R orbit (${orbit}) · W walk${walking ? 'ing' : ''} · C crisp figures ${crisp ? 'on' : 'off (true scale)'}`,
    )
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (k === 'q') orbit = (orbit + 1) % 8
    if (k === 'r') orbit = (orbit + 7) % 8
    if (k === 'c') crisp = !crisp
    if (k === 'w') {
      walking = !walking
      actors = walking ? walk() : stand()
      t = 0
    }
    label()
  })
  label()
  app.ticker.add((tk) => {
    t += tk.deltaMS / 1000
    stage.draw(stageFrame(actors, t, gameplay([0, 0.6, 0], orbit, [w, h]), { crisp }))
  })
}

/** `?free`: the free orbit camera (#22's), a debugging aid. */
async function freeMain() {
  const [w, h] = [innerWidth, innerHeight],
    app = await startApp(w, h, 0x31222a),
    view = new View3D({ width: w, height: h, toneMapping: 'none' })
  app.stage.addChild(view)
  // The scene: a floor, the base pair side by side, an orbit camera.
  const floor = new Mesh3D({
    geometry: new CubeGeometry({ width: 8, height: 0.1, depth: 8 }),
    material: new FlatMaterial({ baseColor: 0x4a353c }),
  })
  floor.position.set(0, -0.05, 0)
  view.root.addChild(floor)
  const figures = BASE.map((b, i) => {
    const f = new FigureSprite(member(b.def, DENSITY))
    f.sprite.position.set(i === 0 ? -0.6 : 0.6, 0, 0)
    view.root.addChild(f.sprite)
    return f
  })
  // The camera's start, in degrees and metres (`?az=45&pitch=30&dist=4`), so a view can be shot again.
  const num = (k: string, d: number) => Number(params.get(k) ?? d)
  let az = num('az', 0) * deg,
    pitch = num('pitch', 18) * deg,
    dist = num('dist', 6),
    facing = num('facing', 0) * deg,
    walking = params.has('walk')
  const target: V3 = [0, 0.9, 0]
  addEventListener('pointermove', (e) => {
    if (e.buttons) {
      az -= e.movementX * 0.01
      pitch = Math.max(2 * deg, Math.min(80 * deg, pitch + e.movementY * 0.01))
    }
  })
  addEventListener('wheel', (e) => {
    dist = Math.max(1.5, Math.min(20, dist * (1 + e.deltaY * 0.001)))
  })
  addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') walking = !walking
    if (e.key === 'ArrowLeft') facing += Math.PI / 4
    if (e.key === 'ArrowRight') facing -= Math.PI / 4
  })
  help('drag to orbit · wheel to zoom · W walk · ←/→ turn the figures')
  app.ticker.add((t) => {
    const dt = t.deltaMS / 1000
    const eye: V3 = [
      target[0] + dist * Math.cos(pitch) * Math.sin(az),
      target[1] + dist * Math.sin(pitch),
      target[2] + dist * Math.cos(pitch) * Math.cos(az),
    ]
    view.camera.position.set(...eye)
    view.camera.lookAt({ x: target[0], y: target[1], z: target[2] })
    for (const f of figures) f.update(dt, { facing, moving: walking, eye, target })
  })
}

const check = params.get('check'),
  name = params.get('case')
if (name !== null) caseMain(name)
else if (check !== null) checkMain(check)
else if (params.has('free')) freeMain()
else gameplayMain()
