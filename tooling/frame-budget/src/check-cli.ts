// `pnpm budget:frame [results folder] [budget file]`: compares the frame-budget probe's results with budget.json.
// Exits 0 when every budgeted project passed, or when every result was drawn by a software renderer (or its
// project skipped for one) and so nothing could be measured ("skipped"). An unset budget, a foreign-GPU result, a
// mix of software and hardware results, or a missing or malformed result (a budgeted project with neither a result
// nor a software-skip record) all exit 1 (fail closed).
import { resolve } from 'node:path'
import { checkFiles } from './budget.ts'
import { resultsDir } from './origin.ts'

const results = resolve(process.argv[2] ?? resultsDir)
const budgetPath = resolve(process.argv[3] ?? resolve(import.meta.dirname, '../budget.json'))
const outcome = checkFiles(budgetPath, results)
for (const line of outcome.lines) console.log(line)
// A skip says plainly that no frame time was measured, so a green run is never read as a passed budget.
const meaning = outcome.verdict === 'skipped' ? ', nothing was measured' : ''
console.log(`frame budget: ${outcome.verdict.toUpperCase()}${meaning} (${results})`)
if (outcome.verdict !== 'pass' && outcome.verdict !== 'skipped') process.exit(1)
