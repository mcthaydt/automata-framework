// S7-Q8 and S7-Q9 timings (spike S7): one module for both runs, Node (bench/rig-bench.ts, M3.1a) and the browser on
// the phone profiles (bench.html, M3.1b's e2e/gpu.e2e.ts).
//
// S7-Q8, the rig solve per figure, with the source's allocating `twoBoneIK` (FigureBuilder rig.ts at a1f7246):
//   - one two-bone solve (an arm), alone;
//   - a pose step: four limb solves (both feet on floor targets, both hands on targets) plus the head aim;
//   - a frame's share: the head aim and one arm (the "aim" figure; pins are the feet, already in the pose step).
// S7-Q9, a figure as @pixi/3d meshes: the joint update (26 joints' local rotation and translation) plus the mesh
// transforms (every part's world matrix, as the view composes them each frame), per figure per frame; and the one-off
// build (skeleton, joints, geometries, materials and meshes) per outfit change.
import { Container3D } from '@pixi/3d'
import { measure } from '../figure/genes.ts'
import { restPose, skeleton } from '../figure/rig.ts'
import { aimHead, reachArm, solveLimbs } from '../scene/aim.ts'
import { MARCH, sampleClip } from '../scene/clip.ts'
import { buildFigure } from '../scene/figure-view.ts'

export interface RigBench {
  readonly joints: number
  readonly meshes: number
  readonly oneSolve: Stat
  readonly poseStep: Stat
  readonly perFrame: Stat
  readonly jointsAndMeshes: Stat
  readonly build: Stat
}

export function runRigBench(): RigBench {
  const COLORS = { skin: 0xf5a097, top: 0x249fde, legs: 0x3e3546, shoes: 0x2e222f }

  const s = skeleton(measure({ height: 168 }).genes)
  const pose = restPose()
  const wobble = (i: number) => Math.sin(i * 0.37) * 0.08
  const targetsAt = (i: number) => ({
    footL: [s.genes.hips + wobble(i), s.genes.ankle, 0.1 + wobble(i)] as [number, number, number],
    footR: [-s.genes.hips, s.genes.ankle + 0.05 * Math.abs(wobble(i)), -0.1] as [number, number, number],
    handL: [0.35, 1.0 + wobble(i), 0.3] as [number, number, number],
    handR: [-0.3, 1.1, 0.35 + wobble(i)] as [number, number, number],
  })
  const look = (i: number): [number, number, number] => [1 + wobble(i), 1.5, 2]

  const oneSolve = time((i) => reachArm(s, pose, 'R', look(i)), 200)
  const poseStep = time((i) => {
    solveLimbs(s, pose, targetsAt(i))
    aimHead(s, pose, look(i))
  }, 100)
  const perFrame = time((i) => {
    aimHead(s, pose, look(i))
    reachArm(s, pose, 'R', look(i))
  }, 100)

  // S7-Q9: a figure on a View3D-less root (the transforms are @pixi/3d's own; no GPU is involved).
  const scene = new Container3D()
  const figure = buildFigure(s, COLORS)
  scene.addChild(figure.root)
  const clipPose = restPose()
  const jointsAndMeshes = time((i) => {
    sampleClip(MARCH, i / 60, clipPose)
    clipPose.root = [wobble(i), 0, wobble(i + 3)]
    figure.applyPose(clipPose)
    for (const mesh of figure.meshes) mesh.getGlobalTransform()
  }, 50)
  const build = time(
    () => {
      const built = buildFigure(skeleton(measure({ height: 170, frame: 0.6 }).genes), COLORS)
      built.root.destroy({ children: true })
    },
    5,
    60,
    10,
  )
  return {
    joints: figure.joints.length,
    meshes: figure.meshes.length,
    oneSolve,
    poseStep,
    perFrame,
    jointsAndMeshes,
    build,
  }
}

export interface Stat {
  readonly mean: number
  readonly p50: number
  readonly p95: number
  readonly samples: number
}

/** Times `body` in batches of `inner` calls after a warm-up; returns ms per call. */
function time(body: (i: number) => void, inner: number, batches = 200, warm = 50): Stat {
  for (let b = 0; b < warm; b++) for (let i = 0; i < inner; i++) body(i)
  const samples: number[] = []
  for (let b = 0; b < batches; b++) {
    const start = performance.now()
    for (let i = 0; i < inner; i++) body(i)
    samples.push((performance.now() - start) / inner)
  }
  samples.sort((a, b) => a - b)
  return {
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    p50: samples[Math.floor(samples.length * 0.5)]!,
    p95: samples[Math.floor(samples.length * 0.95)]!,
    samples: samples.length * inner,
  }
}
