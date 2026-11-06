import '#src/theme.css'
import {
  findUnreachable,
  mountFixture,
  REFERENCE_SIZES,
  type ReferenceSize,
  TIGHT_SIZES,
  VARIANTS,
} from '@mcthaydt/automata-testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, publishConditions } from '#src/testing/layout-contract.ts'
import StatusFixture, { type StatusShow } from '#src/testing/StatusFixture.svelte'
import { settleLayout } from '#src/testing/settle.ts'

// ErrorPanel's one-row layout (spec §3.4): the message and its actions share a row only where the
// message keeps at least 20 characters of width; otherwise the actions stack under it. This fails
// if the one-row rule stops applying (it once never did, from a container query that read the panel
// itself) or applies where it squeezes the message.

let unmount: (() => Promise<void>) | undefined
afterEach(async () => {
  await unmount?.()
  unmount = undefined
})

/** A size outside the reference lists, for the audit's own sweep (smaller than any gate size). */
const custom = (width: number, height: number): ReferenceSize => ({
  name: `${width}x${height}`,
  width,
  height,
  formFactor: width > height ? 'phone-landscape' : 'phone-portrait',
  heightTier: width > height ? 'compact' : undefined,
  group: 'tight',
})

async function show(
  sizeName: string | ReferenceSize,
  which: StatusShow,
  variantName = 'rest',
): Promise<{ message: DOMRect; actions: DOMRect }> {
  const size =
    typeof sizeName === 'string'
      ? [...REFERENCE_SIZES, ...TIGHT_SIZES].find((candidate) => candidate.name === sizeName)
      : sizeName
  const variant = VARIANTS.find((candidate) => candidate.name === variantName)
  if (size === undefined || variant === undefined) throw new Error(`no ${String(sizeName)} or ${variantName}`)
  await page.viewport(size.width, size.height)
  publishConditions(document.documentElement, size, variant)
  unmount = mountFixture(StatusFixture, { show: which }).unmount
  await settleLayout()
  const boot = which === 'boot-failure' || which === 'model-invalid'
  const actions = byTestId(which === 'boot-failure' ? 'error-continue' : 'error-retry').parentElement
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

  test('keeps Back reachable with a row before it rises: two actions at 667x260 with the keyboard', async () => {
    await show('tight-landscape-667', 'error', 'keyboard')
    // A row, not the stack that would rise over Back. Whether the message keeps 20 characters there
    // (`row`) or fewer (`row-tight`) depends on the system font's width, so either passes.
    expect(byTestId('error-panel').dataset.layout).toMatch(/^row(-tight)?$/)
    expect(
      findUnreachable([byTestId('corner-back'), byTestId('error-retry'), byTestId('error-dismiss')]),
    ).toEqual([])
  })

  test('never picks a row that does not fit: one action at 480x150 with the keyboard', async () => {
    await show(custom(480, 150), 'boot-failure', 'keyboard')
    const panel = byTestId('boot-failure')
    const layer = panel.parentElement as HTMLElement
    const contentBottom =
      layer.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(layer).paddingBottom)
    expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(contentBottom + 0.5)
  })

  test('shows a whole action once scrolled to, even where the room is shorter than it: 320x120 with the keyboard', async () => {
    await show(custom(320, 120), 'error', 'keyboard')
    for (const id of ['error-retry', 'error-dismiss']) {
      byTestId(id).scrollIntoView({ block: 'nearest' })
      expect(findUnreachable([byTestId(id)])).toEqual([])
    }
  })

  test('keeps the message inside the panel at TV scale on a narrow phone: 320x640', async () => {
    await show(custom(320, 640), 'error', 'tv-scale')
    const panel = byTestId('error-panel')
    const style = getComputedStyle(panel)
    const contentRight =
      panel.getBoundingClientRect().right -
      Number.parseFloat(style.paddingRight) -
      Number.parseFloat(style.borderRightWidth)
    expect(byTestId('error-panel-message').getBoundingClientRect().right).toBeLessThanOrEqual(
      contentRight + 0.5,
    )
  })

  // M3.4a (review of #241): a damaged model's panel names a hashed file with no break opportunity; at the compact
  // sizes the name wraps inside the panel and Try again, Back to Ruken and the corner's Back stay reachable.
  test.each([
    [780, 270],
    [844, 390],
  ])(
    'keeps a long model file name inside the panel at %ix%i, every action reachable',
    async (width, height) => {
      await show(custom(width, height), 'model-invalid')
      const panel = byTestId('boot-failure')
      const message = byTestId('boot-failure-message')
      const style = getComputedStyle(panel)
      const contentRight =
        panel.getBoundingClientRect().right -
        Number.parseFloat(style.paddingRight) -
        Number.parseFloat(style.borderRightWidth)
      expect(message.getBoundingClientRect().right).toBeLessThanOrEqual(contentRight + 0.5)
      expect(message.scrollWidth).toBeLessThanOrEqual(message.clientWidth + 1)
      expect(
        findUnreachable([byTestId('corner-back'), byTestId('error-retry'), byTestId('error-exit')]),
      ).toEqual([])
    },
  )
})
