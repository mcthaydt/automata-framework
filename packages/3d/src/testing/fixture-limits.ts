// The fixture's shared rig limits (`figure-rigs/default.toml`), read through the content compile so the solver's
// tests use the values the content holds, not a copy.

import type { RigLimits } from '../features/figures/content/rig-limits.schema.ts'
import { compileFixture } from './compile-fixture.ts'

export async function fixtureLimits(): Promise<RigLimits> {
  const result = await compileFixture()
  if (!result.ok) throw new Error(result.message)
  const rigs = (result.content.data as Record<string, Record<string, RigLimits>>)['figure-rig']
  const limits = rigs?.default
  if (!limits) throw new Error('the fixture has no default rig limits')
  return limits
}
