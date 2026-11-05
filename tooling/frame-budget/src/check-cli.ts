// `pnpm budget:frame [results folder] [budget file]`: compares the frame-budget probe's results with budget.json.
// Exits 0 when every budgeted project passed, or when every result was drawn by a software renderer and so could
// not be measured ("skipped"). An unset budget, a foreign-GPU result, a mix of software and hardware results, or a
// missing or malformed result all exit 1 (fail closed).
import { resolve } from 'node:path'
import { checkFiles } from './budget.ts'
import { resultsDir } from './origin.ts'

const results = resolve(process.argv[2] ?? resultsDir)
const budgetPath = resolve(process.argv[3] ?? resolve(import.meta.dirname, '../budget.json'))
const outcome = checkFiles(budgetPath, results)
for (const line of outcome.lines) console.log(line)
console.log(`frame budget: ${outcome.verdict.toUpperCase()} (${results})`)
if (outcome.verdict !== 'pass' && outcome.verdict !== 'skipped') process.exit(1)
