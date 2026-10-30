// S7-Q8 and S7-Q9, first numbers (M3.1a): Node 24 on the machine that runs it, NOT the phone profile (M3.1b
// measures that in the browser on the GPU runner, bench.html). `node bench/rig-bench.ts` prints the Markdown for
// docs/spikes/s7-pixi3d.md. What each measure times is in src/bench/rig-timing.ts.
import { runRigBench, type Stat } from '../src/bench/rig-timing.ts'

const result = runRigBench()
const ms = (n: number) => `${n.toFixed(4)} ms`
const row = (name: string, stat: Stat) =>
  `| ${name} | ${ms(stat.mean)} | ${ms(stat.p50)} | ${ms(stat.p95)} | ${stat.samples} |`
console.log(
  `Node ${process.version}, ${process.platform} ${process.arch}; ${result.joints} joints, ${result.meshes} meshes per figure\n`,
)
console.log('| Measure (per figure) | Mean | p50 | p95 | Calls |\n|---|---|---|---|---|')
console.log(row('S7-Q8 one two-bone solve (arm)', result.oneSolve))
console.log(row('S7-Q8 pose step: 4 limb solves + head aim', result.poseStep))
console.log(row('S7-Q8 per frame: head aim + one arm', result.perFrame))
console.log(row('S7-Q9 joint update + mesh transforms (clip sampled)', result.jointsAndMeshes))
console.log(row('S7-Q9 one-off build (skeleton, joints, meshes)', result.build))
