import { readFileSync, writeFileSync } from 'node:fs'
const report = JSON.parse(readFileSync('.svelte-kit/first-change-results.json', 'utf8'))
const tests = report.testResults.flatMap(result => result.assertionResults.map(test => ({ name: test.title, status: test.status })))
if (!tests.length || tests.some(test => test.status !== 'passed')) throw new Error('The worked example must pass before recording evidence')
writeFileSync('src/data/first-change-proof.json', JSON.stringify({ checkedAt: new Date(report.startTime).toISOString(), tests }, null, 2) + '\n')
