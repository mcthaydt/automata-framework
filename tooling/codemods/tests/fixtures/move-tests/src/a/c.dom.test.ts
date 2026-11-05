import { expect, it, vi } from 'vitest'

vi.mock('./b.ts', () => ({ b: 2 }))

it('c', async () => {
  const { b } = await import('./b.ts')
  expect(b).toBe(2)
  expect(document).toBeDefined()
})
