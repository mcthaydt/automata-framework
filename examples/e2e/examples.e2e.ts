import { fileURLToPath } from 'node:url'
import { readCatalog } from '@mcthaydt/examples-runner'
import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { smokeExamples } from '@mcthaydt/examples-runner/smoke'

// Every example in this folder, at Pixel 7 and at 780 × 270 (playwright.config.ts, projects `examples` and
// `examples-compact`), from the catalog: adding an example adds no test (EX spec §5).
smokeExamples(
  'examples',
  readCatalog(fileURLToPath(new URL('..', import.meta.url))),
  `http://localhost:${examplesPort}`,
)
