// Usage: node tooling/bundle-report/src/cli.ts <build folder>
// Build the game with source maps first (`vite build --sourcemap`), then point this at the output folder. It reads every
// `.js` file that has a `.js.map` beside it and prints the table of bytes by package.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type Chunk, formatTable, reportChunks } from '#src/report.ts'

function jsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? jsFiles(path) : name.endsWith('.js') ? [path] : []
  })
}

const [folder] = process.argv.slice(2)
if (folder === undefined) {
  console.error('usage: bundle-report <build folder>')
  process.exit(2)
}
const chunks: Chunk[] = []
for (const file of jsFiles(resolve(folder))) {
  try {
    chunks.push({ code: readFileSync(file, 'utf8'), map: JSON.parse(readFileSync(`${file}.map`, 'utf8')) })
  } catch {
    // A chunk with no source map cannot be attributed; say so rather than hide its bytes.
    console.error(`bundle-report: ${file} has no readable source map, so it is left out`)
  }
}
if (chunks.length === 0) {
  console.error('bundle-report: no chunks with source maps; build with `vite build --sourcemap`')
  process.exit(1)
}
console.log(formatTable(reportChunks(chunks)))
