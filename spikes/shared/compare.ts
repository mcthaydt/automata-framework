import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

// Usage:
//   node shared/compare.ts a.png b.png --max-ratio 0.01    (must match: at most 1% of pixels differ)
//   node shared/compare.ts a.png b.png --min-ratio 0.05    (must differ: positive control)
// Both images must also have >= --min-colors distinct colors, so blank/black captures can never "match".
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'max-ratio': { type: 'string' },
    'min-ratio': { type: 'string' },
    'min-colors': { type: 'string', default: '8' },
  },
})
const [a, b] = positionals
if (!a || !b) throw new Error('usage: node shared/compare.ts a.png b.png (--max-ratio R | --min-ratio R)')
const A = PNG.sync.read(readFileSync(a))
const B = PNG.sync.read(readFileSync(b))
if (A.width !== B.width || A.height !== B.height) {
  throw new Error(`size mismatch ${A.width}x${A.height} vs ${B.width}x${B.height}`)
}
const distinct = (img: PNG) => {
  const set = new Set<number>()
  for (let i = 0; i < img.data.length; i += 4) set.add(img.data.readUInt32BE(i))
  return set.size
}
const colorsA = distinct(A)
const colorsB = distinct(B)
const diffPixels = pixelmatch(A.data, B.data, undefined, A.width, A.height, { threshold: 0.1 })
const ratio = diffPixels / (A.width * A.height)
const minColors = Number(values['min-colors'])
let ok = colorsA >= minColors && colorsB >= minColors
if (values['max-ratio'] !== undefined) ok &&= ratio <= Number(values['max-ratio'])
if (values['min-ratio'] !== undefined) ok &&= ratio >= Number(values['min-ratio'])
console.log(JSON.stringify({ ok, ratio, diffPixels, colorsA, colorsB }))
process.exit(ok ? 0 : 1)
