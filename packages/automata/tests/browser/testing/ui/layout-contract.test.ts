import '#src/shared/ui/theme.css'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'

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
  // M4 spec §4.9: the touch overlay is an intruder like the keyboard or Ruken's strip. A control of the screen
  // under a touch button would lose its taps to a thumb, or hide the button.
  test('fails a control that sits under a touch button, and passes the touch buttons themselves', async () => {
    const touch =
      '<div data-touch-overlay style="position:fixed;left:0;top:300px;width:200px;height:60px">' +
      '<button data-action="left" data-testid="touch-left" style="width:60px;height:60px">L</button></div>'
    const under =
      '<button data-testid="under" style="position:fixed;left:20px;top:320px;width:48px;height:48px">X</button>'
    expect(await check(corner + touch)).toEqual([])
    expect(await check(corner + touch + under)).toContain('under is under a touch button')
  })

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

  // PRODUCT.L3a: in a long language a Settings group was wider than the dialog's list, which scrolls up and down; the
  // options past its side were cut, where a player would not think to scroll. A scroll region may clip a control
  // (`findOffscreenControls` passes it), but only across its scrolling direction, never at a side.
  const region = (inner: string): string =>
    `<div data-scroll-region style="width:200px;height:100px;overflow-y:auto">${inner}</div>`

  test('fails a control cut at the side of the scroll region it scrolls in', async () => {
    const wide =
      '<div style="width:300px"><button data-testid="far" style="margin-left:180px;width:60px;height:48px">Far</button></div>'
    expect(await check(region(wide))).toEqual(['far is cut at the side of its scroll region'])
  })

  test('judges a radio by its label, which is what a player presses', async () => {
    const option =
      '<div style="width:300px"><label data-testid="option" style="display:inline-block;margin-left:180px;width:60px;height:48px">' +
      '<input type="radio" name="o" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Far</label></div>'
    expect(await check(region(option))).toEqual(['option is cut at the side of its scroll region'])
  })

  test('passes a region that only scrolls down, and what overflows it that is not a control', async () => {
    const tall = '<button data-testid="low" style="margin-top:200px;width:60px;height:48px">Low</button>'
    const margin =
      '<div style="position:relative"><div style="position:absolute;left:-24px;right:-24px;height:20px"></div></div>'
    expect(await check(region(tall + margin))).toEqual([])
  })

  // An editor's dock holds a strip of scenes wider than itself, which a player scrolls sideways (editor-kit's
  // EditorShell): a region that scrolls both ways on purpose says so, and a control past its side is reached by
  // scrolling it.
  test('passes a control past the side of a region that scrolls sideways on purpose (data-scroll-region="both")', async () => {
    const strip =
      '<div style="display:flex;width:400px"><button data-testid="floor-6" style="margin-left:300px;width:60px;height:48px">Six</button></div>'
    const both = `<div data-scroll-region="both" style="width:200px;height:100px;overflow:auto">${strip}</div>`
    expect(await check(both)).toEqual([])
  })

  // An overflow box clips only what it contains: an absolute control whose positioned ancestor lies outside the
  // region is drawn where it is, and scrolling the region would never move it (testing's containing-block rule).
  test('judges an absolute control positioned outside the region where it is drawn, not at the region’s side', async () => {
    const pinned =
      '<button data-testid="pinned" style="position:absolute;left:150px;top:0;width:60px;height:48px">Pin</button>'
    const outside = `<div style="position:relative;width:300px;height:120px">${region(pinned)}</div>`
    expect(await check(outside)).toEqual([])
  })

  // PRODUCT.L3a: in a long language a Toggle's state word was squeezed to three characters and ran past the toggle,
  // over the list's side. A control's words stay inside it, wherever it sits.
  test('fails a control whose words run past its edge', async () => {
    const squeezed =
      '<button data-testid="squeezed" style="width:60px;height:48px;white-space:nowrap;justify-content:start">A long label</button>'
    expect(await check(squeezed)).toEqual(["squeezed's words run past its edge"])
  })

  test('passes words a control hides from sight on purpose: a visually hidden name', async () => {
    const icon =
      '<button data-testid="icon" style="position:relative;width:48px;height:48px">' +
      '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap">' +
      'A long name read aloud, never drawn</span>X</button>'
    expect(await check(icon)).toEqual([])
  })

  test('passes words a box inside the control clamps on purpose: a two-line clamp', async () => {
    const slot =
      '<button data-testid="slot" style="display:block;width:160px;height:48px;padding:4px">' +
      '<span style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font:16px/20px sans-serif">' +
      'A long name a player typed, which runs on for many more lines than two</span></button>'
    expect(await check(slot)).toEqual([])
  })

  // A focusable scroll region (the editors' error panel lines) scrolls its long lines rather than wrapping them: words
  // past its edge are reached by scrolling, not spilled. A control that cuts its words off without scrolling still fails.
  test('passes words a control scrolls to on purpose: a scroll region with long lines', async () => {
    const lines =
      '<div data-testid="lines" tabindex="0" style="width:120px;height:48px;overflow:auto;white-space:pre">' +
      'A line far longer than the region is wide\nand another</div>'
    expect(await check(lines)).toEqual([])
  })

  test('fails a control that cuts its words off without scrolling', async () => {
    const cut =
      '<button data-testid="cut" style="width:60px;height:48px;overflow:hidden;white-space:nowrap;justify-content:start">A long label</button>'
    expect(await check(cut)).toEqual(["cut's words run past its edge"])
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
  /**
   * A panel shaped like ErrorPanel's: a message line and an actions box, stacked, with its inline
   * floor. `actions` is the actions' height, so the panel's real least floor is 20 + `actions`
   * (the contract measures it; `claimed` is what the panel says, which the contract must not trust).
   */
  const alert = (style: string, actions: number, claimed = 0, extra = ''): string =>
    `<div role="alert" data-testid="error" data-layout="stack" data-fit-floor="${claimed}" ${extra} ` +
    `style="background:red;pointer-events:auto;flex-shrink:0;display:grid;font:16px/20px sans-serif;${style}">` +
    `<p class="af-error-panel__message" style="margin:0">Failed</p>` +
    `<div class="af-error-panel__actions" style="height:${actions}px"></div></div>`

  test('fails anything that covers Back', async () => {
    const cover = '<div style="position:fixed;left:0;top:0;width:100px;height:100px;background:red"></div>'
    expect(await check(frame() + cover)).toEqual(['back is covered or clipped at its centre'])
  })

  test('fails an error panel over Back that did not have to rise: taller than its floor', async () => {
    expect(await check(frame() + layer(alert('min-height:50px;height:104px', 84)))).toEqual([
      'back is covered or clipped at its centre',
    ])
  })

  test('fails an error panel over Back that did not have to rise: room left under it', async () => {
    expect(await check(frame() + layer(alert('min-height:80px;height:80px;margin-bottom:20px', 60)))).toEqual(
      ['back is covered or clipped at its centre'],
    )
  })

  test('fails an error panel over Back where a layout fits under the corner row, whatever it claims', async () => {
    expect(await check(frame() + layer(alert('min-height:104px;height:104px', 20, 200)))).toEqual([
      'back is covered or clipped at its centre',
    ])
  })

  test('passes an error panel at its floor that fills the room, so it had to rise over Back', async () => {
    expect(await check(frame() + layer(alert('min-height:104px;height:104px', 84)))).toEqual([])
  })

  test('passes a scrolling panel where no layout fits the room, and fails one where a layout does', async () => {
    const scrolling = (actions: number): string =>
      frame() +
      layer(alert('flex:1 1 0;overflow-y:auto', actions, 0, 'data-overflow data-scroll-region'), true)
    expect(await check(scrolling(180))).toEqual([])
    expect(await check(scrolling(50))).toEqual(['back is covered or clipped at its centre'])
  })

  test('passes Back covered by a modal dialog: the page behind it is inert', async () => {
    const cover = '<div style="position:fixed;left:0;top:0;width:100px;height:100px;background:red"></div>'
    expect(await check(`<div inert>${frame()}</div>${cover}`)).toEqual([])
  })

  test("checks a screen's own way out (data-way-out) where it has no corner row", async () => {
    const back =
      '<button data-way-out data-testid="leave" style="position:fixed;left:200px;top:200px;width:72px;height:48px">Leave</button>'
    const cover =
      '<div style="position:fixed;left:190px;top:190px;width:100px;height:100px;background:red"></div>'
    expect(await check(back + cover)).toEqual(['leave is covered or clipped at its centre'])
  })
})
