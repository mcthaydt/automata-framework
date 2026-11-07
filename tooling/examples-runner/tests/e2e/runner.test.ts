import { fileURLToPath } from 'node:url'
import { readCatalog } from '#src/catalog.ts'
import { smokeExamples } from '#src/smoke.ts'
import { runnerFixturesPort } from '../../host/ports.ts'

// The runner's own smoke run over its fixtures (fixtures.vite.config.ts): the stub example boots under the fake
// host with Ruken's headers, and the pending one is reported as pending. Proves the path real examples take.
const fixture = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const entries = readCatalog(fixture('../fixtures/examples/'), {
  deliveryPlan: fixture('../fixtures/catalog/delivery-plan.md'),
})

smokeExamples('runner fixtures', entries, `http://localhost:${runnerFixturesPort}`)
