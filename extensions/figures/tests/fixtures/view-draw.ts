// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 27 of the builders-fold plan (the strict flags) replaces each with a check
/**
 * What the browser suite draws on a real GPU: a named stage frame through `StageView`, and one base figure in one of its
 * 8 views under an orthographic camera, each read back as RGBA. The page is the test's own, so every draw makes a fresh
 * Pixi application and destroys it again; nothing a draw leaves behind can reach the next.
 */
import '@pixi/3d'
import { FlatMaterial, Mesh3D, PlaneGeometry, View3D } from '@pixi/3d'
import { Application, BufferImageSource, Graphics, Texture } from 'pixi.js'
import { BASE, member, type V3 } from '#src/entries/index.ts'
import { FigureSprite, StageView } from '#src/entries/view.ts'
import { CASES } from './view-cases.ts'

export type Renderer = 'webgl' | 'webgpu'

/** The canvas as RGBA, top row first. */
export interface Readback {
  w: number
  h: number
  rgba: Uint8ClampedArray
}

/** A readback with what the page found out about its renderer: the one it got, and whether per-texel depth is on. */
export interface CaseReadback extends Readback {
  renderer: string
  perTexelDepth: boolean
}

/** A transparent, unsmoothed canvas that keeps its drawing buffer, so it can be read back. */
async function startApp(w: number, h: number, preference: Renderer): Promise<Application> {
  const app = new Application()
  await app.init({
    width: w,
    height: h,
    backgroundAlpha: 0,
    preference,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    preserveDrawingBuffer: true,
  })
  document.body.appendChild(app.canvas)
  return app
}

/**
 * Renders, renders again in the next animation frame, and copies the canvas in that same task: a WebGPU canvas keeps
 * no drawing buffer past the task that drew it.
 */
function settle(app: Application): Promise<Readback> {
  app.render()
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      app.render()
      const canvas = app.canvas as HTMLCanvasElement,
        copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      const context = copy.getContext('2d')!
      context.drawImage(canvas, 0, 0)
      resolve({
        w: canvas.width,
        h: canvas.height,
        rgba: context.getImageData(0, 0, canvas.width, canvas.height).data,
      })
    })
  })
}

/** Removes the application and its canvas, and frees its GPU context. */
function dispose(app: Application): void {
  app.destroy(true, { children: true })
}

/**
 * The named case's frame, drawn through `StageView` under `preference`; `twice` draws it a second time from a rebuilt
 * frame before the readback (what determinism asks of a page that draws again).
 */
export async function drawCase(name: string, preference: Renderer, twice = false): Promise<CaseReadback> {
  const c = CASES[name]
  if (!c) throw new Error(`no case ${name}`)
  let frame = c.frame()
  const [w, h] = frame.camera.size,
    app = await startApp(w, h, preference),
    stage = new StageView([w, h], c.range)
  try {
    app.stage.addChild(stage.view)
    if (c.wall) {
      // The case's wall, in the scene beside the figures: a plane facing +z, one colour through the same texture path as a cell.
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
    const renderer = app.renderer.name, // a WebGPU page must really have got WebGPU
      perTexelDepth = stage.perTexelDepth === true // and the first render found a renderer that depth-tests per texel
    if (twice) {
      frame = c.frame()
      stage.draw(frame)
    }
    return { ...(await settle(app)), renderer, perTexelDepth }
  } finally {
    dispose(app)
  }
}

/** The pixel a texel is: one base figure (`who` 0 or 1) in view `view` of the 8, as the sheets draw it, in this page. */
export async function drawStanding(who: number, view: number): Promise<Readback> {
  const cast = member(BASE[who].def, 2),
    [cw, ch] = cast.cell,
    ppm = ch / cast.metres,
    app = await startApp(cw, ch, 'webgl'),
    scene = new View3D({ width: cw, height: ch, toneMapping: 'none' })
  try {
    app.stage.addChild(scene)
    // One figure facing view `view`, the camera on +z at 18°, orthographic, a texel a pixel.
    const fig = new FigureSprite(cast)
    scene.root.addChild(fig.sprite)
    const pitch = (18 * Math.PI) / 180,
      aim = (ch / 2 - cast.feet) / ppm / Math.cos(pitch),
      target: V3 = [0, aim, 0],
      eye: V3 = [0, aim + 20 * Math.sin(pitch), 20 * Math.cos(pitch)]
    scene.camera.mode = 'orthographic'
    scene.camera.orthographicSize = cw / 2 / ppm
    scene.camera.position.set(...eye)
    scene.camera.lookAt({ x: target[0], y: target[1], z: target[2] })
    for (let i = 0; i < 3; i++)
      fig.update(1 / 60, { facing: (view * Math.PI) / 4, moving: false, eye, target })
    return await settle(app)
  } finally {
    dispose(app)
  }
}

/** What this browser's WebGPU does: grants no adapter (Pixi falls back to WebGL), grants one that draws no frame, or presents. */
export type WebgpuState = 'no adapter' | 'no frame' | 'presents'

/**
 * Whether WebGPU presents a frame here at all, asked with one opaque red square and no figure. A headless Chromium on some
 * machines is granted an adapter and then reads back transparent black whatever is drawn, which says nothing about the stage;
 * if the plain square presents and the cases do not, the cases are what is wrong.
 */
export async function webgpuState(): Promise<WebgpuState> {
  const app = await startApp(8, 8, 'webgpu')
  try {
    if (app.renderer.name !== 'webgpu') return 'no adapter'
    app.stage.addChild(new Graphics().rect(0, 0, 8, 8).fill(0xff0000))
    const { rgba } = await settle(app)
    return rgba[0] === 255 && rgba[1] === 0 && rgba[2] === 0 && rgba[3] === 255 ? 'presents' : 'no frame'
  } finally {
    dispose(app)
  }
}
