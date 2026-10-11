import { expect, it } from 'vitest'
import { GOLDEN_HASH, runGolden } from './golden.ts'

// The same run as golden.test.ts, in Chromium, WebKit and Firefox: the hash must match Node's bit for bit.
it('the golden run ends on the recorded hash in this browser', async () => {
  const result = await runGolden()
  expect(result.rejected).toBe(0)
  expect(result.hash).toBe(GOLDEN_HASH)
})
