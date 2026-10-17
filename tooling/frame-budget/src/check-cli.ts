// `pnpm budget:frame [results folder]`: compares the frame-budget probe's results with budget.json. Exits 0 only
// when every budgeted project passed; an unset budget, a software-rendered or foreign-GPU result, or a missing
// or malformed result all exit 1 (fail closed).
import { resolve } from 'node:path'
import { checkFiles } from './budget.ts'
import { resultsDir } from './origin.ts'

const budgetPath = resolve(import.meta.dirname, '../budget.json')
const results = resolve(process.argv[2] ?? resultsDir)
const outcome = checkFiles(budgetPath, results)
for (const line of outcome.lines) console.log(line)
console.log(`frame budget: ${outcome.verdict.toUpperCase()} (${results})`)
if (outcome.verdict !== 'pass') process.exit(1)
