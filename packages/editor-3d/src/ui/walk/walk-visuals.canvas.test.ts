import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The review images of Walk and the material sheet (plan ED3D.8b), for the delegated visual acceptance. Written only with
// `ED3D_VISUALS=1`; never compared against, never a golden.

const OUT = '../../../../../docs/evidence/owner-visual/2026-10-31-ed3d-8b'

afterEach(stopEditor)

const named = (name: string) => {
  const size = SIZES.find((each) => each.name === name)
  if (size === undefined) throw new Error(`no size ${name}`)
  return size
}

function click(group: string, name: string): void {
  ;[...document.querySelectorAll<HTMLElement>(`[role="radiogroup"][aria-label="${group}"] [role="radio"]`)]
    .find((each) => each.textContent?.trim() === name)
    ?.click()
}

async function shoot(file: string): Promise<void> {
  await arrived()
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await page.screenshot({ path: `${OUT}/${file}` })
}

async function openWalk(name: string): Promise<void> {
  await startAt(named(name), async (workspace) => {
    await workspace.store.write('depot/depot.json', depotText)
  })
  await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
  document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
  click('View', 'Walk')
  await expect
    .poll(() => document.querySelector('[data-testid="walk-canvas"][data-phase="drawing"]'))
    .not.toBeNull()
}

describe.runIf(inject('writeVisuals'))('Walk images for review', () => {
  it('Walk at ipad-pro-11-landscape, standing at the spawn', async () => {
    await openWalk('ipad-pro-11-landscape')
    await shoot('walk-ipad-pro-11-landscape.png')
  })

  it('Fly at ipad-pro-13-landscape', async () => {
    await openWalk('ipad-pro-13-landscape')
    click('Walk mode', 'Fly')
    await shoot('walk-fly-ipad-pro-13-landscape.png')
  })
})
