import '#src/shared/ui/theme.css'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { BAR_ACTIONS, findCovered, findCutByBar } from '#src/testing/layout/assertions.ts'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import { checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'

// Every action in a bar is whole and uncovered (3D slice task 1.5, audit note 17). A bar that clips its overflow cuts
// a button it cannot fit, and `findClipped` never sees it: that measures a node's own vertical overflow. A phone's
// Studio top bar cut Publish this way. Real browsers: the checks read laid-out boxes.

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

const button = (name: string, width: number): string =>
  `<button style="flex:none;width:${width}px;height:48px">${name}</button>`

describe('actions inside their bars', () => {
  test('reports a bar button its bar clips', async () => {
    const bar = `<div data-region="topbar" style="width:120px;overflow:hidden;display:flex">${button('Back', 100)}${button('Publish', 80)}</div>`
    expect(await check(bar)).toContainEqual(expect.stringContaining('Publish is cut by'))
  })

  test('passes a bar whose buttons all fit', async () => {
    const bar = `<div data-region="topbar" style="width:300px;overflow:hidden;display:flex">${button('Back', 100)}${button('Publish', 80)}</div>`
    expect(await check(bar)).toEqual([])
  })

  test('lets a bar that scrolls on purpose hold buttons past its side', async () => {
    const bar = `<div data-region="topbar" data-scroll-region="both" style="width:120px;overflow:auto;display:flex">${button('Back', 100)}${button('Publish', 80)}</div>`
    document.body.innerHTML = bar
    expect(findCutByBar(document.body, BAR_ACTIONS)).toEqual([])
  })

  test('lets a modal dialog cover the bar', () => {
    document.body.innerHTML = `<div data-region="topbar">${button('Save', 80)}</div><dialog open aria-modal="true" style="position:fixed;inset:0;margin:0;width:100%;height:100%"></dialog>`
    expect(findCovered(document.body, BAR_ACTIONS)).toEqual([])
  })

  test('reports a bar button another element covers', () => {
    document.body.innerHTML = `<div data-region="topbar">${button('Save', 80)}</div><div style="position:fixed;inset:0"></div>`
    expect(findCovered(document.body, BAR_ACTIONS)).toEqual([expect.stringContaining('Save')])
  })

  test('lets an element the caller excuses cover the bar', () => {
    document.body.innerHTML = `<div data-region="topbar">${button('Save', 80)}</div><div id="risen" style="position:fixed;inset:0"></div>`
    expect(findCovered(document.body, BAR_ACTIONS, (cover) => cover.id === 'risen')).toEqual([])
  })
})
