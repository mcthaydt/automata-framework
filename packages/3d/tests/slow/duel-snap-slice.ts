// One worker of the exhaustive snap check: for each blue level in its share of the cube, every red and green level, in every
// Bayer cell, the full loop's answer against the table's. Run by `duel-snap-exhaustive.test.ts`, not a test itself.
import { parentPort, workerData } from 'node:worker_threads'
import { BAYER } from '#src/features/look/duel-snap.ts'
import { candidateTable, referenceSnap, tableSnap } from '#src/features/look/duel-snap-table.ts'

const { strength, blues } = workerData as { strength: number; blues: number[] }
const table = candidateTable(strength)
let checked = 0
const wrong: string[] = []
for (const b of blues)
  for (let g = 0; g < 256; g++)
    for (let r = 0; r < 256; r++) {
      const rgb: [number, number, number] = [r / 255, g / 255, b / 255]
      for (let cell = 0; cell < BAYER.length; cell++) {
        checked++
        const want = referenceSnap(rgb, cell, strength)
        const got = tableSnap(table, rgb, cell, strength)
        if (got !== want && wrong.length < 20) wrong.push(`${r},${g},${b}@${cell}: ${got} not ${want}`)
      }
    }
parentPort?.postMessage({ checked, wrong })
