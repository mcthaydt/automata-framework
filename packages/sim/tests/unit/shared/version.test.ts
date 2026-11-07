import { expect, test } from 'vitest'
import { SIM_VERSION } from '#src/shared/version.ts'
import pkg from '../../../package.json' with { type: 'json' }

// M2.4's version step rewrites both; this test keeps them from drifting apart (M2.3 spec §12 Q2).
test('SIM_VERSION equals the package version', () => {
  expect(SIM_VERSION).toBe(pkg.version)
})
