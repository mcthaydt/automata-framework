import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BudgetFile } from '#src/budget.ts'
import { SOFTWARE_SKIP, softwareSkip, stressPageOf } from '#src/stress-3d.ts'

// The 3D look's frame budgets (spec 6): a phone at 30 frames a second, an iPad at 60, and the first figure posed in
// 5 ms. The numbers are the spec's targets until the Owner's GPU run replaces them with measured ones.
const budget = BudgetFile.parse(
  JSON.parse(readFileSync(new URL('../../budget.json', import.meta.url), 'utf8')),
)

describe('the 3D frame budgets', () => {
  it('budget.json has the 3D rows', () => {
    if (budget.status !== 'set') throw new Error('the budget is not set')
    expect(budget.projects['frame-budget-3d-phone']).toEqual({ workMsP95: 33.3, intervalMsP95: 33.3 })
    expect(budget.projects['frame-budget-3d-ipad']).toEqual({ workMsP95: 16.7, intervalMsP95: 16.7 })
    expect(budget.firstPoseMs).toBe(5)
  })

  it('keeps the 2D rows as they were', () => {
    if (budget.status !== 'set') throw new Error('the budget is not set')
    expect(budget.projects['frame-budget-phone']).toEqual({ workMsP95: 12.75, intervalMsP95: 20.88 })
    expect(budget.projects['frame-budget-desktop']).toEqual({ workMsP95: 12.63, intervalMsP95: 20.88 })
  })
})

describe('the 3D probe on a machine with no GPU', () => {
  it('a software renderer skips with "Skipped: software renderer, no frame budget measured."', () => {
    expect(SOFTWARE_SKIP).toBe('Skipped: software renderer, no frame budget measured.')
    expect(softwareSkip('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))')).toBe(SOFTWARE_SKIP)
    expect(softwareSkip('llvmpipe (LLVM 17.0.6, 256 bits)')).toBe(SOFTWARE_SKIP)
    expect(softwareSkip('unknown')).toBe(SOFTWARE_SKIP)
  })

  it('a GPU is measured', () => {
    expect(softwareSkip('ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)')).toBeUndefined()
  })
})

describe('which page a project measures', () => {
  it('sends the 3D projects to the 3D page and the others to the core stress page', () => {
    expect(stressPageOf('frame-budget-3d-phone')).toBe('stress/3d/index.html')
    expect(stressPageOf('frame-budget-3d-ipad')).toBe('stress/3d/index.html')
    expect(stressPageOf('frame-budget-phone')).toBe('')
    expect(stressPageOf('frame-budget-desktop')).toBe('')
  })
})
