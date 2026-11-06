// Run the test-move codemod on one package:
//   node tooling/codemods/src/cli.ts packages/sim --environment node [--dry-run]
//     [--extra-root deploy] [--other-environment src/sim] [--keep-qualifier src/input/keys.analog.test.ts]
// A dry run prints the plan (move counts per kind, what stays, what needs a person's eyes) and changes nothing.
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { applyPlan, type Environment, type MoveConfig, planMoves } from '#src/move-tests.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    environment: { type: 'string', default: 'node' },
    'other-environment': { type: 'string', multiple: true, default: [] },
    'keep-qualifier': { type: 'string', multiple: true, default: [] },
    'extra-root': { type: 'string', multiple: true, default: [] },
    'dry-run': { type: 'boolean', default: false },
  },
})

const [packageDir] = positionals
if (!packageDir || (values.environment !== 'node' && values.environment !== 'jsdom')) {
  console.error('usage: cli.ts <package folder> --environment node|jsdom [--dry-run]')
  process.exit(2)
}

const root = resolve(packageDir)
const config: MoveConfig = {
  root,
  environment: values.environment as Environment,
  otherEnvironment: values['other-environment'],
  keepQualifier: values['keep-qualifier'],
  extraRoots: values['extra-root'],
}
// `git ls-files` run inside the package prints paths relative to it, and lists only what git tracks (no build output).
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', cwd: root })
  .split('\0')
  .filter(Boolean)
  .map((path) => resolve(root, path))
const plan = planMoves(config, files)

const perKind = new Map<string, number>()
for (const move of plan.moves) perKind.set(move.kind, (perKind.get(move.kind) ?? 0) + 1)
console.log(
  `${root}: ${plan.moves.length} files move (${[...perKind].map(([k, n]) => `${k} ${n}`).join(', ')})`,
)
if (plan.stayed.length > 0)
  console.log(`stay in src (a published helper imports them): ${plan.stayed.join(', ')}`)
if (plan.needsEyes.length > 0)
  console.log(`find files at run time, check by eye:\n  ${plan.needsEyes.join('\n  ')}`)

if (!values['dry-run']) {
  applyPlan(config, plan, { move: (from, to) => void execFileSync('git', ['mv', from, to], { cwd: root }) })
  console.log('moved with git mv; run the package tests next')
}
