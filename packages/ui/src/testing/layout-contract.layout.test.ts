import '../theme.css'
import { REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { checkLayout, publishConditions } from './layout-contract'

// The checks the contract adds to the shared assertions (M1.6 spec §3.4, §5), each against a
// planted problem. Real browsers: the checks read laid-out boxes.

const [size] = REFERENCE_SIZES
const [rest] = VARIANTS

afterEach(() => {
  document.body.innerHTML = ''
})

async function check(html: string): Promise<string[]> {
  if (size === undefined || rest === undefined) throw new Error('no reference size or variant')
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, rest)
  document.body.innerHTML = html
  return checkLayout(conditions, [])
}

const cornerRow =
  '<div data-corner-controls style="position:fixed;left:0;top:0;width:300px;height:48px">' +
  '<button data-testid="back" style="width:48px;height:48px">Back</button></div>'
/** A screen frame holding the corner row and `content`. */
const frame = (content = ''): string => `<div data-screen-frame>${cornerRow}${content}</div>`
const corner = frame()

describe('checkLayout', () => {
  test('passes a clean page', async () => {
    expect(await check(corner)).toEqual([])
  })

  test('fails an ActionBar that had to wrap its primary onto a row of its own (level 3)', async () => {
    expect(await check('<div data-action-bar data-collapse="3" data-testid="bar"></div>')).toEqual([
      'bar collapsed to level 3',
    ])
    expect(await check('<div data-action-bar data-collapse="2" data-testid="bar"></div>')).toEqual([])
  })

  test("fails a control of the same screen that overlaps the screen's corner row", async () => {
    const over =
      '<button data-testid="play" style="position:fixed;left:100px;top:20px;width:80px;height:48px">Play</button>'
    expect(await check(frame(over))).toEqual(['play overlaps corner row'])
  })

  test('passes an overlay over the screen (an error, a dialog) that covers the corner row', async () => {
    const overlay =
      '<button data-testid="retry" style="position:fixed;left:100px;top:20px;width:80px;height:48px">Retry</button>'
    expect(await check(frame() + overlay)).toEqual([])
  })

  test('fails a row that clips what it holds', async () => {
    const row =
      '<div data-row data-testid="row-Forest" style="height:20px;overflow:hidden"><div style="height:44px"></div></div>'
    expect(await check(row)).toEqual(['row-Forest clips 24px'])
  })

  // An error layer like ErrorPanel's: 120px tall with 8px padding, so its content box ends at 112px,
  // passing taps through everywhere but its panel; a 52px corner gap (Back and a gutter) sits above
  // the panel, so 52px of the 104px room is under the corner row.
  const layer = (panel: string, short = false): string =>
    '<div style="position:fixed;left:0;right:0;top:0;height:120px;box-sizing:border-box;' +
    `padding:${short ? '0' : '8px'};display:flex;flex-direction:column;pointer-events:none;--af-gutter:8px">` +
    `<div data-corner-gap style="flex:0 1 ${short ? '0px' : '52px'}"></div>${panel}</div>`
  /** A panel with its inline floor and the least floor of its layouts (`data-fit-floor`). */
  const alert = (style: string, fit: number, extra = ''): string =>
    `<div role="alert" data-testid="error" data-fit-floor="${fit}" ${extra} ` +
    `style="background:red;pointer-events:auto;flex-shrink:0;${style}">Failed</div>`

  test('fails anything that covers Back', async () => {
    const cover = '<div style="position:fixed;left:0;top:0;width:100px;height:100px;background:red"></div>'
    expect(await check(frame() + cover)).toEqual(['back is covered or clipped at its centre'])
  })

  test('fails an error panel over Back that did not have to rise: taller than its floor', async () => {
    expect(await check(frame() + layer(alert('min-height:50px;height:104px', 104)))).toEqual([
      'back is covered or clipped at its centre',
    ])
  })

  test('fails an error panel over Back that did not have to rise: room left under it', async () => {
    expect(await check(frame() + layer(alert('min-height:80px;height:80px;margin-bottom:20px', 80)))).toEqual(
      ['back is covered or clipped at its centre'],
    )
  })

  test('fails an error panel over Back where another layout fits under the corner row', async () => {
    expect(await check(frame() + layer(alert('min-height:104px;height:104px', 40)))).toEqual([
      'back is covered or clipped at its centre',
    ])
  })

  test('passes an error panel at its floor that fills the room, so it had to rise over Back', async () => {
    expect(await check(frame() + layer(alert('min-height:104px;height:104px', 104)))).toEqual([])
  })

  test('passes a scrolling panel where no layout fits the room, and fails one where a layout does', async () => {
    const scrolling = (fit: number): string =>
      frame() + layer(alert('flex:1 1 0;overflow-y:auto', fit, 'data-overflow data-scroll-region'), true)
    expect(await check(scrolling(200))).toEqual([])
    expect(await check(scrolling(90))).toEqual(['back is covered or clipped at its centre'])
  })

  test('passes Back covered by a modal dialog: the page behind it is inert', async () => {
    const cover = '<div style="position:fixed;left:0;top:0;width:100px;height:100px;background:red"></div>'
    expect(await check(`<div inert>${frame()}</div>${cover}`)).toEqual([])
  })

  test("checks a screen's own way out (data-way-out) where it has no corner row", async () => {
    const back =
      '<button data-way-out data-testid="leave" style="position:fixed;left:200px;top:200px;width:48px;height:48px">Leave</button>'
    const cover =
      '<div style="position:fixed;left:190px;top:190px;width:100px;height:100px;background:red"></div>'
    expect(await check(back + cover)).toEqual(['leave is covered or clipped at its centre'])
  })
})
