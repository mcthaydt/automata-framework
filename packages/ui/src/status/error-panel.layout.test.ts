import '../theme.css'
import { mountFixture, REFERENCE_SIZES, TIGHT_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, publishConditions } from '../testing/layout-contract'
import StatusFixture, { type StatusShow } from '../testing/StatusFixture.svelte'
import { settleLayout } from '../testing/settle'

// ErrorPanel's one-row layout (spec §3.4): the message and its actions share a row only where the
// message keeps at least 20 characters of width; otherwise the actions stack under it. This fails
// if the one-row rule stops applying (it once never did, from a container query that read the panel
// itself) or applies where it squeezes the message.

let unmount: (() => Promise<void>) | undefined
afterEach(async () => {
  await unmount?.()
  unmount = undefined
})

async function show(sizeName: string, which: StatusShow): Promise<{ message: DOMRect; actions: DOMRect }> {
  const size = [...REFERENCE_SIZES, ...TIGHT_SIZES].find((candidate) => candidate.name === sizeName)
  const rest = VARIANTS.find((variant) => variant.name === 'rest')
  if (size === undefined || rest === undefined) throw new Error(`no ${sizeName} or rest variant`)
  await page.viewport(size.width, size.height)
  publishConditions(document.documentElement, size, rest)
  unmount = mountFixture(StatusFixture, { show: which }).unmount
  await settleLayout()
  const boot = which === 'boot-failure'
  const actions = byTestId(boot ? 'error-continue' : 'error-retry').parentElement
  if (actions === null) throw new Error('no actions row')
  const message = byTestId(boot ? 'boot-failure-message' : 'error-panel-message')
  return { message: message.getBoundingClientRect(), actions: actions.getBoundingClientRect() }
}

describe('ErrorPanel one-row layout', () => {
  test("shares one row where the message keeps its width: the boot failure's one action on a desktop", async () => {
    const { message, actions } = await show('desktop-720p', 'boot-failure')
    expect(actions.left).toBeGreaterThanOrEqual(message.right)
    expect(actions.top).toBeLessThan(message.bottom)
  })

  test('stacks the actions under the message where a row would squeeze it: three actions at 844x390', async () => {
    const { message, actions } = await show('iphone-14-landscape', 'error-three')
    expect(actions.top).toBeGreaterThanOrEqual(message.bottom)
  })

  test('stacks on a narrow phone', async () => {
    const { message, actions } = await show('phone-small', 'error')
    expect(actions.top).toBeGreaterThanOrEqual(message.bottom)
  })

  test('moves the actions beside a narrow message when a keyboard leaves too little room to stack them', async () => {
    const size = TIGHT_SIZES.find((candidate) => candidate.name === 'tight-landscape-520')
    const keyboard = VARIANTS.find((variant) => variant.name === 'keyboard')
    if (size === undefined || keyboard === undefined)
      throw new Error('no tight-landscape-520 or keyboard variant')
    await show('tight-landscape-520', 'error')
    const panel = byTestId('error-panel')
    expect(panel.dataset.layout).toBe('stack')
    // The keyboard rises over the mounted panel: it re-decides from the layer's new height.
    publishConditions(document.documentElement, size, keyboard)
    await settleLayout()
    expect(panel.dataset.layout).toBe('row-tight')
    const actions = byTestId('error-retry').parentElement?.getBoundingClientRect()
    expect(actions?.left).toBeGreaterThanOrEqual(
      byTestId('error-panel-message').getBoundingClientRect().right,
    )
  })
})
