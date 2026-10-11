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
})
