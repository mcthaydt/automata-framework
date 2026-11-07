import { describe, expect, test } from 'vitest'
import { classifyFormFactor } from '#src/shared/ui/geometry/form-factor.ts'
import { classifyHeightTier } from '#src/shared/ui/geometry/height-tier.ts'
import { REFERENCE_SIZES } from '../../../../../src/testing/layout/reference-sizes.ts'

// The testing package records what each reference size should be; the classifiers must agree.
describe('reference sizes classify as recorded (M1.6 spec §3.10)', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height) is $formFactor, tier $heightTier', (size) => {
    expect(classifyFormFactor(size.width, size.height)).toBe(size.formFactor)
    expect(classifyHeightTier(size.height)).toBe(size.heightTier)
  })
})
