import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { readCatalog } from './catalog.ts'
import { typecheckConfig } from './typecheck.ts'

const root = fileURLToPath(new URL('./fixtures/examples/', import.meta.url))
const deliveryPlan = fileURLToPath(new URL('./fixtures/catalog/delivery-plan.md', import.meta.url))

it('typechecks every example except the pending ones (EX spec §7), on top of the package’s own tsconfig', () => {
  const config = typecheckConfig(root, readCatalog(root, { deliveryPlan }))
  expect(config.extends).toBe(`${root}tsconfig.json`)
  expect(config.files).toEqual([`${root}core/core-stub.ts`])
  expect(config.include).toEqual([`${root}vite.config.ts`, `${root}e2e/*.ts`])
})
