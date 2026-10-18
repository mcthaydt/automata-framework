import { FakePad, hold, type MatrixCell, type MatrixHost } from '@mcthaydt/automata-testing/e2e'
import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Frame, type Page, type TestInfo, test } from '@playwright/test'

// The input × form-factor matrix (M4.10, M4 spec §9.1, M-a). Each `matrix-<cell>` project in playwright.config.ts
// is one cell of `INPUT_MATRIX`; this file plays §9.1's journey once per host the cell lists, on core-input-rebind:
// title → play → move and jump → pause → Settings → rebind jump → resume → the new binding jumps and the old one
// does not → title. Every screen it visits passes the in-page layout check, and the run ends with no console error
// or CSP violation. Action ids follow keys(): act-0 left, act-1 right, act-2 jump, act-3 fire.
//
// A touch cell rebinds with a keyboard (a Bluetooth keyboard on a phone): Settings rebinds keys and pad buttons, not
// touch buttons (§4.5). It plays with its touch buttons.
const URL = `http://localhost:${examplesPort}/core/input-rebind/`
const RIGHT = 'act-1'
const JUMP = 'act-2'

const cellOf = (info: TestInfo): MatrixCell => info.project.metadata.cell as MatrixCell

/** Boots the example under `host`, with the fake pad installed and connected for a gamepad cell. */
async function open(page: Page, host: MatrixHost, pad: FakePad | undefined): Promise<Frame> {
  let frame: Frame
  if (host === 'fake-ruken') frame = await openHosted(page, URL, 'core-input-rebind')
  else {
    await page.goto(URL)
    frame = page.mainFrame()
    await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')
  }
  await frame.evaluate(() => document.fonts.ready)
  await pad?.in(frame).connect()
  return frame
}

/** Waits `count` animation frames in `frame`. */
const frames = (frame: Frame, count: number) =>
  frame.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n
        const tick = (): void => (--left <= 0 ? resolve() : void requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
    count,
  )

/** The stage as pixels: the only view the test has of the sim, so "moved" means the picture changed. */
const shot = (frame: Frame) => frame.locator('[data-layer="stage"] canvas').screenshot()

/** The stage once nothing moves: two captures six frames apart agree (the runner has landed). */
async function settled(frame: Frame): Promise<Buffer> {
  let last = await shot(frame)
  for (;;) {
    await frames(frame, 6)
    const next = await shot(frame)
    if (next.equals(last)) return next
    last = next
  }
}

/** How one device plays: menus, the held actions of play, and the rebind. */
interface Driver {
  /** Moves focus to the control matching `selector` and presses it. */
  choose(selector: string): Promise<void>
  pause(): Promise<void>
  back(): Promise<void>
  /** Holds `action`'s current binding until `until` resolves true, checked once a frame. */
  holdAction(action: 'right' | 'jump' | 'new-jump' | 'old-jump', until: () => Promise<boolean>): Promise<void>
  /** Starts a capture on jump's rebind button and presses the new binding. */
  rebindJump(): Promise<void>
}

/** The stage while `action` has been held for eight frames (a jump rises 24 px in that time). */
async function heldShot(
  driver: Driver,
  frame: Frame,
  action: 'jump' | 'new-jump' | 'old-jump',
): Promise<Buffer> {
  let picture: Buffer | undefined
  await driver.holdAction(action, async () => {
    await frames(frame, 8)
    picture = await shot(frame)
    return true
  })
  if (picture === undefined) throw new Error('no picture')
  return picture
}

/** Walks focus with `step` until it is on `selector`, at most 30 steps. */
async function walk(frame: Frame, selector: string, step: () => Promise<void>): Promise<void> {
  for (let steps = 0; steps < 30; steps++) {
    if (await frame.evaluate((query) => document.activeElement?.matches(query) ?? false, selector)) return
    await step()
  }
  throw new Error(`focus never reached ${selector}`)
}

function keyboardDriver(page: Page, frame: Frame): Driver {
  const keyFor = { right: 'ArrowRight', jump: 'Space', 'new-jump': 'KeyK', 'old-jump': 'Space' } as const
  const press = async (key: string) => {
    await frame.locator('body').press(key)
    await frames(frame, 2)
  }
  return {
    choose: async (selector) => {
      await walk(frame, selector, () => press('ArrowDown'))
      await press('Enter')
    },
    pause: () => press('Escape'),
    back: () => press('Escape'),
    holdAction: async (action, until) => {
      // Play focuses its Pause button, and an unbound Space (jump's old key, once rebound) would press it.
      await frame.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.keyboard.down(keyFor[action])
      try {
        while (!(await until())) await frames(frame, 1)
      } finally {
        await page.keyboard.up(keyFor[action])
      }
    },
    rebindJump: async () => {
      await walk(frame, `[data-control-row="${JUMP}"] [data-rebind="keyboard"]`, () => press('ArrowDown'))
      await press('Enter')
      await expect(frame.locator('[data-settings-section="controls"]')).toHaveAttribute(
        'data-state',
        'capturing',
      )
      await press('KeyK')
    },
  }
}

function gamepadDriver(frame: Frame, pad: FakePad): Driver {
  const buttonFor = { right: 'dpadRight', jump: 'south', 'new-jump': 'north', 'old-jump': 'south' } as const
  return {
    choose: async (selector) => {
      await walk(frame, selector, () => pad.step('down', 'dpad'))
      await pad.tap('south')
    },
    pause: () => pad.tap('start'),
    back: () => pad.tap('east'),
    holdAction: async (action, until) => {
      await pad.press(buttonFor[action])
      try {
        while (!(await until())) await pad.frames(1)
      } finally {
        await pad.release(buttonFor[action])
      }
    },
    rebindJump: async () => {
      await walk(frame, `[data-control-row="${JUMP}"] [data-rebind="gamepad"]`, () =>
        pad.step('down', 'dpad'),
      )
      await pad.tap('south')
      await expect(frame.locator('[data-settings-section="controls"]')).toHaveAttribute(
        'data-state',
        'capturing',
      )
      await pad.tap('north')
    },
  }
}

function touchDriver(page: Page, frame: Frame): Driver {
  const keyboard = keyboardDriver(page, frame)
  const buttonFor = { right: RIGHT, jump: JUMP } as const
  return {
    choose: (selector) => frame.locator(selector).tap(),
    pause: () => frame.getByTestId('pause').tap(),
    back: () => frame.getByTestId('corner-back').tap(),
    holdAction: (action, until) =>
      action === 'right' || action === 'jump'
        ? hold(frame.getByTestId(buttonFor[action]), until)
        : keyboard.holdAction(action, until),
    rebindJump: async () => {
      await frame.locator(`[data-control-row="${JUMP}"] [data-rebind="keyboard"]`).tap()
      await expect(frame.locator('[data-settings-section="controls"]')).toHaveAttribute(
        'data-state',
        'capturing',
      )
      await frame.locator('body').press('KeyK')
    },
  }
}

/**
 * The part of the layout contract a journey can check in the game's own page: the document never scrolls, and every
 * visible control is at least 44 px and on screen, unless it sits in a declared scroll region. The full contract
 * (reserved areas, the corner row, touch intrusions) is the layout suites' (`checkLayout`).
 */
async function expectLayout(frame: Frame, screen: string): Promise<void> {
  const problems = await frame.evaluate(() => {
    const found: string[] = []
    const root = document.documentElement
    if (root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1)
      found.push('the document scrolls')
    // The selector and the radio rule are packages/testing's `visibleControls` and `findSmallTargets`.
    const controls =
      "button, input, select, textarea, summary, a[href], [role='button'], [role='link'], [role='tab'], [tabindex]:not([tabindex='-1'])"
    for (const control of document.querySelectorAll<HTMLElement>(controls)) {
      if (control.closest('[inert]') !== null) continue
      const own = control.getBoundingClientRect()
      if (own.width === 0 || own.height === 0 || getComputedStyle(control).visibility === 'hidden') continue
      // A checkbox or radio is pressed through its label.
      const choice =
        control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')
      const box =
        (choice ? (control as HTMLInputElement).labels?.[0]?.getBoundingClientRect() : undefined) ?? own
      const name = control.dataset.testid ?? control.getAttribute('aria-label') ?? control.textContent?.trim()
      if (box.width < 43.5 || box.height < 43.5) found.push(`${name} is ${box.width}×${box.height}`)
      const scrolls = control.closest('[data-scroll-region]') !== null
      const off =
        box.left < -0.5 || box.top < -0.5 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5
      if (off && !scrolls) found.push(`${name} is off screen`)
    }
    return found
  })
  expect(problems, `layout on ${screen}`).toEqual([])
}

async function journey(page: Page, cell: MatrixCell, host: MatrixHost): Promise<void> {
  const errors = await collectErrors(page)
  const pad = cell.device === 'gamepad' ? await FakePad.install(page) : undefined
  const frame = await open(page, host, pad)
  const driver =
    cell.device === 'gamepad' && pad !== undefined
      ? gamepadDriver(frame, pad)
      : cell.device === 'touch'
        ? touchDriver(page, frame)
        : keyboardDriver(page, frame)
  const screen = (id: string) => frame.getByTestId(`${id}-screen`)

  await expect(screen('title')).toBeVisible()
  await expectLayout(frame, 'title')
  await driver.choose('[data-testid="play"]')
  await expect(screen('play')).toBeVisible()
  await expectLayout(frame, 'play')

  // Move: a tap of right moves the runner for good. Jump: the picture taken while it is held differs from the
  // landed one (a jump tops out at y 30, on the stage). The sim steps by the wall clock and a software renderer's
  // frames are slow, so any longer hold of right can walk the runner off the stage before the capture.
  const start = await settled(frame)
  await driver.holdAction('right', async () => true)
  expect((await settled(frame)).equals(start), 'holding right did not move the runner').toBe(false)
  expect(await heldShot(driver, frame, 'jump')).not.toEqual(await settled(frame))

  await driver.pause()
  await expect(screen('paused')).toBeVisible()
  await expectLayout(frame, 'paused')
  await driver.choose('[data-testid="settings"]')
  await expect(screen('settings')).toBeVisible()
  await expectLayout(frame, 'settings')
  await driver.rebindJump()
  await expect(frame.locator('[data-settings-section="controls"]')).toHaveAttribute('data-state', 'saved')

  await driver.back()
  await expect(screen('paused')).toBeVisible()
  await driver.choose('[data-testid="resume"]')
  await expect(screen('play')).toBeVisible()

  // The old binding no longer jumps; the new one does. A capture of the canvas takes whatever is drawn over it, so
  // the focus ring comes off first (the keyboard driver clears focus before each held key).
  await frame.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  // A touch cell checks with the keyboard, and the first key hides the touch buttons: switch before the capture.
  if (cell.device === 'touch') await frame.locator('body').press('Shift')
  const landed = await settled(frame)
  expect((await heldShot(driver, frame, 'old-jump')).equals(landed), 'the old binding still jumps').toBe(true)
  await expect(screen('play')).toBeVisible()
  expect((await heldShot(driver, frame, 'new-jump')).equals(landed), 'the new binding does not jump').toBe(
    false,
  )
  await expect(screen('play')).toBeVisible()

  await driver.pause()
  await expect(screen('paused')).toBeVisible()
  await driver.choose('[data-testid="quit"]')
  await expect(screen('title')).toBeVisible()
  expect(errors).toEqual([])
}

for (const host of ['fake-ruken', 'standalone'] as const) {
  test(`§9.1 journey, ${host === 'fake-ruken' ? 'under the fake Ruken host' : 'standalone'}`, async ({
    page,
  }, info) => {
    const cell = cellOf(info)
    test.skip(!cell.hosts.includes(host), `the ${cell.formFactor} cells run under the fake host only`)
    // Twelve screens and a dozen canvas captures in a software renderer, four journeys at once: a desktop cell
    // under the host took 2 min locally (WebKit is slower still, DX.3 E-7).
    test.setTimeout(240_000)
    await journey(page, cell, host)
  })
}
