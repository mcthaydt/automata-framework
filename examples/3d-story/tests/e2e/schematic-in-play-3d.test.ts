import { readFileSync, writeFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { editorUrl, gameUrl } from './origins.ts'

// What a person edits in Schematic is what the game plays: the guard's sight, its speed, a switch and a new character,
// each changed through the editors' own buttons (never by writing the TOML here), then played in the game, where the game's
// debug window (`window.__automataDebug`, development builds only) says what the sim did. Every size edits the same three
// files, so each project puts them back as it found them.

const root = new URL('../../', import.meta.url).pathname
const FILES = ['content/systems/hall.toml', 'content/nav/hall.toml', 'content/puzzles/hall.toml']
let original: Record<string, string> = {}

test.describe.configure({ mode: 'serial' })
test.beforeAll(() => {
  original = Object.fromEntries(FILES.map((file) => [file, readFileSync(root + file, 'utf8')]))
})
test.afterAll(() => {
  for (const file of FILES) writeFileSync(root + file, original[file] as string)
})

interface Probe {
  tick(): number
  agents(): { id: string; mode: string; x: number; z: number; walking: boolean }[]
  player(): { x: number; z: number }
  changes(): { tick: number; agent: string; from: string; to: string }[]
  trail(agent: string): { tick: number; x: number; z: number }[]
}
const probe = <T>(page: Page, run: (debug: Probe) => T): Promise<T> =>
  page.evaluate(`(${run.toString()})(window.__automataDebug)`) as Promise<T>

/** The game, started: the title screen's Play pressed and the sim running. */
async function play(page: Page): Promise<void> {
  // The game is landscape only (it asks a phone held upright to turn), so it is played the way a phone is held for it.
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto(gameUrl)
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(
    () => (window as never as { __automataDebug?: Probe }).__automataDebug?.agents().length,
  )
}
/** The editors, open on Schematic's first scene (the guard's file). */
async function openGuard(editors: Page): Promise<void> {
  await editors.goto(editorUrl)
  await editors.getByText('Schematic', { exact: true }).last().click()
  await editors.getByText('Hall', { exact: true }).first().click()
  await expect(editors.getByRole('region', { name: 'Schematic' })).toBeVisible()
}
/** Opens the inspector when it is a sheet (a phone) rather than a column beside the diagram. */
async function inspector(editors: Page, shows: string): Promise<void> {
  const field = editors.getByLabel(shows, { exact: true }).first()
  if (!(await field.isVisible())) await editors.getByRole('button', { name: 'Details' }).click()
  await expect(field).toBeVisible()
}
async function setNumber(editors: Page, label: string, value: number): Promise<void> {
  await inspector(editors, label)
  const field = editors.getByLabel(label, { exact: true }).first()
  await field.fill(String(value))
  await field.press('Tab')
}
const fileHas = (file: string, text: string) =>
  expect.poll(() => readFileSync(root + file, 'utf8')).toContain(text)

test('the guard stays on patrol for 3 s while the player is 5 m away, outside its 4 m sight', async ({
  page,
}) => {
  await play(page)
  const start = await probe(page, (d) => d.tick())
  await page.waitForFunction(
    (from) => ((window as never as { __automataDebug: Probe }).__automataDebug.tick() - from) / 60 >= 3,
    start,
  )
  const state = await probe(page, (d) => ({ agents: d.agents(), player: d.player(), changes: d.changes() }))
  expect(state.changes).toEqual([])
  const [guard] = state.agents
  expect(guard?.mode).toBe('patrol')
  expect(Math.hypot((guard?.x ?? 0) - state.player.x, (guard?.z ?? 0) - state.player.z)).toBeGreaterThan(4)
  await page.screenshot({ path: test.info().outputPath('1-guard-patrols.png') })
})

test('Watch: stepping the player into sight lights Hunt on the diagram and logs the switch', async ({
  context,
}) => {
  const editors = await context.newPage()
  await openGuard(editors)
  await editors.getByRole('button', { name: 'Watch it run' }).click()
  const pane = editors.getByRole('region', { name: 'Watch' })
  await expect(pane).toBeVisible()
  const game = pane.frameLocator('iframe')
  await game.getByRole('button', { name: 'Play' }).click()
  // The player starts 5 m from the guard; stepping toward it (screen left is east) brings it within 4 m.
  await editors.keyboard.down('KeyA')
  await expect(editors.getByRole('log', { name: 'What happened' })).toContainText(
    'went from Patrol to Hunt',
    {
      timeout: 20_000,
    },
  )
  await editors.keyboard.up('KeyA')
  await expect(editors.locator('[data-live="true"]').first()).toHaveAccessibleName(/^Hunt, /)
  await editors.screenshot({ path: test.info().outputPath('watch-hunt.png') })
})

test('raising the guard’s sight to 7 m in Schematic makes it hunt within 1 s', async ({ page, context }) => {
  const editors = await context.newPage()
  await openGuard(editors)
  await setNumber(editors, 'Sees up to', 7)
  await fileHas(FILES[0] as string, 'range = 7')
  await editors.screenshot({ path: test.info().outputPath('2-sight-7.png') })
  await play(page)
  await page.waitForFunction(
    () => (window as never as { __automataDebug: Probe }).__automataDebug.changes().length > 0,
  )
  const [first] = await probe(page, (d) => d.changes())
  expect(first).toMatchObject({ agent: 'guard', from: 'patrol', to: 'hunt' })
  expect(first?.tick).toBeLessThanOrEqual(60)
})

test('Hunt’s speed 2.2 to 3.5 m/s in Schematic: the guard covers 3.5 m in the first second of its hunt', async ({
  page,
  context,
}) => {
  const editors = await context.newPage()
  await openGuard(editors)
  await editors.getByRole('button', { name: /^Hunt, 2\.2 m\/s/ }).click()
  await setNumber(editors, 'Moves at', 3.5)
  await fileHas(FILES[0] as string, 'hunt = 3.5')
  await editors.screenshot({ path: test.info().outputPath('3-hunt-speed.png') })
  await play(page)
  await page.waitForFunction(() => {
    const d = (window as never as { __automataDebug: Probe }).__automataDebug
    const hunt = d.changes().find((c) => c.to === 'hunt')
    return hunt !== undefined && d.tick() >= hunt.tick + 70
  })
  const covered = await probe(page, (d) => {
    const hunt = d.changes().find((c) => c.to === 'hunt') as { tick: number }
    const trail = d.trail('guard')
    const at = (tick: number) => trail.find((p) => p.tick >= tick) as { x: number; z: number }
    const a = at(hunt.tick)
    const b = at(hunt.tick + 60)
    return Math.hypot(b.x - a.x, b.z - a.z)
  })
  expect(covered).toBeGreaterThan(3.4)
  expect(covered).toBeLessThan(3.6)
})

test('pointing Patrol to Hunt at Search instead: the guard’s first change is to Search', async ({
  page,
  context,
}) => {
  const editors = await context.newPage()
  await openGuard(editors)
  // On a phone the switches are behind the List toggle; on an iPad they are under the diagram.
  const sw = editors.locator('button', { hasText: 'Patrol to Hunt: sees the player' }).first()
  const listTab = editors.getByRole('tab', { name: 'List', exact: true })
  await expect(sw.or(listTab).first()).toBeVisible()
  if (!(await sw.isVisible())) await listTab.click()
  await sw.click()
  // The switch's inspector opens with where it comes from and where it goes: the second choice is "To".
  const to = editors.getByRole('region', { name: 'Switch' }).locator('select').nth(1)
  if (!(await to.isVisible())) await editors.getByRole('button', { name: 'Details' }).click()
  await expect(to).toBeVisible()
  await to.selectOption('search')
  await editors.screenshot({ path: test.info().outputPath('4-switch-to-search.png') })
  await play(page)
  await page.waitForFunction(
    () => (window as never as { __automataDebug: Probe }).__automataDebug.changes().length > 0,
  )
  const [first] = await probe(page, (d) => d.changes())
  expect(first).toMatchObject({ agent: 'guard', from: 'patrol', to: 'search' })
})

test('a Sentry added at the west end exists there in play and sounds the alarm when the player walks into its sight', async ({
  page,
  context,
}) => {
  const editors = await context.newPage()
  await openGuard(editors)
  // On a phone the list of characters is a sheet behind the Panel button; on an iPad it is the column on the left.
  const ready = editors.getByLabel('Add a ready-made character')
  if (!(await ready.isVisible())) await editors.getByRole('button', { name: 'Panel' }).click()
  await ready.selectOption('sentry')
  await inspector(editors, 'Place')
  await editors.getByLabel('Place', { exact: true }).first().selectOption('west')
  await fileHas(FILES[0] as string, 'id = "sentry"')
  await editors.screenshot({ path: test.info().outputPath('5-sentry-added.png') })
  await play(page)
  const sentry = await probe(page, (d) => d.agents().find((a) => a.id === 'sentry'))
  expect(sentry).toBeDefined()
  expect(sentry?.x).toBeCloseTo(-7, 0)
  expect(sentry?.z).toBeCloseTo(0, 0)
  // Screen right is toward the west end: the camera looks along +z. The sentry sees 8 m, the player starts 9 m away.
  await page.keyboard.down('KeyD')
  await page.waitForFunction(() =>
    (window as never as { __automataDebug: Probe }).__automataDebug
      .changes()
      .some((c) => c.agent === 'sentry'),
  )
  await page.keyboard.up('KeyD')
  const alarm = await probe(page, (d) => d.changes().find((c) => c.agent === 'sentry'))
  expect(alarm).toMatchObject({ from: 'patrol', to: 'alarm' })
  await page.screenshot({ path: test.info().outputPath('5-sentry-alarm.png') })
})
