import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { float, pass, vec4 } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { gpuInfo } from '../shared/gpu-info'

const params = new URLSearchParams(location.search)
const requested = params.get('backend') === 'webgl2' ? 'webgl2' : 'webgpu'
const dither = params.get('dither') !== '0' // ?dither=0 renders the plain frame (positive control)
const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL: requested === 'webgl2' })
renderer.setPixelRatio(1)
renderer.setSize(480, 270)
document.body.appendChild(renderer.domElement)
await renderer.init()
const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x202040)
scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 2))
const camera = new THREE.PerspectiveCamera(60, 480 / 270, 0.1, 100)
camera.position.set(0, 1.5, 4)
camera.lookAt(0, 0, 0)
const material = new THREE.MeshStandardMaterial({ color: 0xff8844, flatShading: true })
const meshes = Array.from({ length: 5 }, (_, i) => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), material)
  m.position.set(i - 2, 0, 0)
  scene.add(m)
  return m
})
const pipeline = new THREE.RenderPipeline(renderer)
const scenePass = pass(scene, camera)
pipeline.outputNode = dither ? vec4(bayerDither(scenePass.rgb, float(8)), 1) : scenePass

const pose = (t: number) => {
  meshes.forEach((m, i) => {
    m.rotation.set(i * 0.3 + t, i * 0.5 + t * 0.7, 0)
  })
}

// Animated FPS measurement over 300 frames (recorded, not gated: rAF caps it at the display rate).
const frames = 300
let count = 0
const t0 = performance.now()
await new Promise<void>((done) => {
  const frame = () => {
    pose(count / 60)
    pipeline.render()
    count += 1
    if (count < frames) requestAnimationFrame(frame)
    else done()
  }
  requestAnimationFrame(frame)
})
const fps = frames / ((performance.now() - t0) / 1000)

// Static frame for the screenshot comparison.
pose(0)
pipeline.render()
await new Promise((r) => requestAnimationFrame(() => r(null)))
;(window as unknown as { __result: unknown }).__result = {
  ok: backend === requested, // Review Focus #2: a silent fallback fails the run
  requested,
  backend,
  dither,
  fps: Math.round(fps),
  gpu: await gpuInfo(),
}
