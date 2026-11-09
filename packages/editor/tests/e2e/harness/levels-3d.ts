// The steps a journey takes in Levels 3D, by what a person sees: Home's card for the room, the Things tool, a thing
// dragged to a place in metres, and a room's card. Plan metres become page pixels through the status line's pointer
// read-out (it says where the pointer is on the plan), as the editor's own layout tests do, so a journey says
// "drag the crate to 3, 6.5" and not a pixel.
import { expect, type Locator, type Page } from '@playwright/test'
import type { RunningEditor } from './run-editor.ts'

const PLAN = '[data-testid="plan-canvas"]'

/** Opens the editor, then the level (by its name in words, as Home shows it) in Levels 3D, and waits for the plan. */
export async function openLevels3d(page: Page, editor: RunningEditor, level: string): Promise<void> {
  await page.goto(editor.url)
  await page.getByRole('region', { name: 'Levels' }).getByRole('button', { name: level }).click()
  await expect(page.locator(PLAN)).toBeVisible()
  await expect(page.locator(PLAN)).not.toHaveAttribute('data-phase', 'starting')
}

interface PagePoint {
  readonly x: number
  readonly y: number
}

/** Where the status line says the pointer is, in metres; it prints a true minus sign. */
async function statusPoint(page: Page): Promise<{ x: number; z: number }> {
  const words = (await page.locator('p.status').first().textContent()) ?? ''
  const read = (axis: 'x' | 'z') => Number(new RegExp(`${axis} (\\S+) m`).exec(words)?.[1]?.replace('−', '-'))
  return { x: read('x'), z: read('z') }
}

/** Hovers two points of the plan and reads where the status line says they are: the metres-to-page map. */
async function calibrate(page: Page): Promise<(x: number, z: number) => PagePoint> {
  const box = await page.locator(PLAN).boundingBox()
  if (box === null) throw new Error('the plan is not on the page')
  const pages = [
    { x: box.x + box.width * 0.25, y: box.y + box.height * 0.25 },
    { x: box.x + box.width * 0.75, y: box.y + box.height * 0.75 },
  ] as const
  const metres: { x: number; z: number }[] = []
  for (const at of pages) {
    // The first move after the page changes may not draw the read-out; the second is the one read.
    await page.mouse.move(at.x - 1, at.y - 1)
    await page.mouse.move(at.x, at.y)
    await expect
      .poll(async () => {
        const read = await statusPoint(page)
        return Number.isFinite(read.x) && Number.isFinite(read.z)
      })
      .toBe(true)
    metres.push(await statusPoint(page))
  }
  const [p0, p1] = pages
  const [m0, m1] = metres as [{ x: number; z: number }, { x: number; z: number }]
  return (x, z) => ({
    x: p0.x + ((x - m0.x) * (p1.x - p0.x)) / (m1.x - m0.x),
    y: p0.y + ((z - m0.z) * (p1.y - p0.y)) / (m1.z - m0.z),
  })
}

/** Chooses the Thing tool in the top bar (the Layers panel has a Things row of its own). */
export async function chooseThingsTool(page: Page): Promise<void> {
  await page
    .getByRole('toolbar', { name: 'Tools' })
    .getByRole('button', { name: 'Thing', exact: true })
    .click()
}

/** Chooses the Select tool in the top bar. */
export async function chooseSelectTool(page: Page): Promise<void> {
  await page
    .getByRole('toolbar', { name: 'Tools' })
    .getByRole('button', { name: 'Select', exact: true })
    .click()
}

/** With the Things tool chosen: drags the thing standing at `from` (metres) to `to`, with a pointer, as one gesture. */
export async function dragThing(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
): Promise<void> {
  const pageOf = await calibrate(page)
  const start = pageOf(from[0], from[1])
  const end = pageOf(to[0], to[1])
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  const steps = 8
  for (let step = 1; step <= steps; step++)
    await page.mouse.move(
      start.x + ((end.x - start.x) * step) / steps,
      start.y + ((end.y - start.y) * step) / steps,
    )
  await page.mouse.up()
}

/** With the Select tool chosen: taps the room standing at `at` (metres), so its card opens. */
export async function selectRoomAt(page: Page, at: readonly [number, number]): Promise<void> {
  const pageOf = await calibrate(page)
  const point = pageOf(at[0], at[1])
  await page.mouse.click(point.x, point.y)
}

/** Types a value into a stepper of the card that is open (Floor, Ceiling) and commits it. */
export async function setCardField(page: Page, name: string, value: string): Promise<void> {
  const field = page.getByRole('spinbutton', { name })
  // Below the widest layout the card sits in a sheet behind the top bar's Details button.
  if (!(await field.isVisible())) await page.getByRole('button', { name: 'Details' }).click()
  // The value is a spinbutton; Enter opens its text field, and Enter again commits what was typed.
  await field.press('Enter')
  const typed = page.getByRole('textbox', { name })
  await typed.fill(value)
  await typed.press('Enter')
}

/** Picks a time of day by its label on the level's card (nothing selected); below the widest layout it sits behind Details. */
export async function setTimeOfDay(page: Page, label: string): Promise<void> {
  const picker = page.getByRole('button', { name: /Time of day/ })
  const details = page.getByRole('button', { name: 'Details' })
  const sheet = !(await picker.isVisible())
  if (sheet) await details.click()
  await picker.click()
  await page.getByRole('option', { name: label }).click()
  // The sheet covers the plan, which the next step draws on: close what this opened.
  if (sheet) await details.click()
}

/**
 * How bright the picture a canvas shows is, 0 (black) to 1 (white): the mean of its pixels' luminance. A journey that
 * says a time of day reaches the game asks this of the game's own picture, not of a word the page writes about it.
 */
export async function meanLuminance(page: Page, canvas: Locator): Promise<number> {
  const picture = (await canvas.screenshot()).toString('base64')
  return page.evaluate(async (data) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const paper = document.createElement('canvas')
    paper.width = image.width
    paper.height = image.height
    const context = paper.getContext('2d')
    if (context === null) throw new Error('no 2d canvas to read the picture with')
    context.drawImage(image, 0, 0)
    const { data: pixels } = context.getImageData(0, 0, paper.width, paper.height)
    let sum = 0
    for (let at = 0; at < pixels.length; at += 4)
      sum +=
        0.2126 * (pixels[at] as number) +
        0.7152 * (pixels[at + 1] as number) +
        0.0722 * (pixels[at + 2] as number)
    return sum / (pixels.length / 4) / 255
  }, picture)
}
