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
  await focusGame(frame)
  await pad?.in(frame).connect()
  return frame
}

/**
 * Gives the game's frame the keyboard when the game did not get it, as a player's click on the game does. Under a host
 * the game is an iframe, and a key press goes to the frame the page has focused. The game focuses its own first
 * control on entry, which also makes its frame that one, except that in WebKit with other pages busy the browser
 * ignored the call: `document.hasFocus()` stayed false and `activeElement` stayed `body`, so all 30 of `walk`'s
 * presses reached the host page (the Mac's `focus never reached play`; reproduced with six CPU hogs on four cores,
 * 12 of 12 runs). `locator('body').press` cannot fix it, because `body` is not focusable; the frame's element in the
 * host page is. A frame that already has focus keeps what the game focused: focusing the element resets it to `body`.
 * Standalone, the game is the page and has it.
 */
async function focusGame(frame: Frame): Promise<void> {
  if (frame.parentFrame() === null) return
  if (await frame.evaluate(() => document.hasFocus())) return
  await (await frame.frameElement()).evaluate((element) => (element as HTMLElement).focus())
  await expect
    .poll(() => frame.evaluate(() => document.hasFocus()), { message: 'the game frame did not take focus' })
    .toBe(true)
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

/**
 * The stage as pixels: the only view the test has of the sim, so "moved" means the picture changed. A capture of the
 * canvas takes whatever is drawn over it (a focus ring, a touch button over the runner), so the screens and overlay
 * layers are hidden for the capture and shown again straight after.
 */
async function shot(frame: Frame): Promise<Buffer> {
  const cover = (hidden: boolean) =>
    frame.evaluate((hide) => {
      for (const layer of document.querySelectorAll<HTMLElement>(
        '[data-layer="screens"], [data-layer="overlay"]',
      ))
        layer.style.visibility = hide ? 'hidden' : ''
    }, hidden)
  await cover(true)
  try {
    return await frame.locator('[data-layer="stage"] canvas').screenshot()
  } finally {
    await cover(false)
  }
}

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
  const where = await frame.evaluate(
    () =>
      `${document.activeElement?.tagName ?? 'nothing'} is active, the frame has focus: ${document.hasFocus()}`,
  )
  throw new Error(`focus never reached ${selector} (${where})`)
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
    // The dialog's Close, named Back: drawn at every size (Back under Settings is only on tall bands).
    back: () => frame.locator('[data-testid="settings-screen"] [data-modal-close]').tap(),
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

  // Move: right held for 100 ms of the game's clock (six ticks, 12 px) moves the runner for good. Jump: the picture
  // taken while it is held differs from the landed one (a jump tops out at y 30, on the stage). The sim steps by the
  // wall clock, so the hold is measured in it: counted in frames, it is under a tick in a fast engine (never sampled)
  // and seconds in a slow software renderer (the runner walks off the stage).
  const start = await settled(frame)
  const since = await frame.evaluate(() => performance.now())
  await driver.holdAction('right', async () => (await frame.evaluate(() => performance.now())) - since >= 100)
  expect((await settled(frame)).equals(start), 'holding right did not move the runner').toBe(false)
  expect(await heldShot(driver, frame, 'jump')).not.toEqual(await settled(frame))

  await driver.pause()
  await expect(screen('paused')).toBeVisible()
  await expectLayout(frame, 'paused')
  await driver.choose('[data-testid="settings"]')
  await expect(screen('settings')).toBeVisible()
  await expectLayout(frame, 'settings')
  // The controls are on Settings' second tab (FloorFifty's Settings and Controls).
  await driver.choose('[data-testid="settings-tab-controls"]')
  await expect(frame.locator('[data-settings-section="controls"]')).toBeVisible()
  await driver.rebindJump()
  await expect(frame.locator('[data-settings-section="controls"]')).toHaveAttribute('data-state', 'saved')

  await driver.back()
  await expect(screen('paused')).toBeVisible()
  await driver.choose('[data-testid="resume"]')
  await expect(screen('play')).toBeVisible()

  // The old binding no longer jumps; the new one does.
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
  // Quit asks first: the run is lost.
  await driver.choose('[data-testid="quit-confirm"]')
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

// Host events (§9.1: desktop and phone portrait, Chromium, under the fake host). They run in the desktop keyboard and
// phone-portrait touch cells, once each.
const HOST_EVENT_CELLS = ['desktop-keyboard-chromium', 'phone-portrait-touch-chromium']
const onlyIn = (info: TestInfo, ids: readonly string[]) =>
  test.skip(!ids.includes(cellOf(info).id), `runs in ${ids.join(' and ')}`)

/** Plays from the title by the cell's own device: a tap on a touch cell, Enter otherwise. */
async function playFrom(frame: Frame, cell: MatrixCell): Promise<void> {
  if (cell.device === 'touch') await frame.getByTestId('play').tap()
  else await frame.locator('body').press('Enter')
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // A marker on the screen's element tells a remount: a new element would not carry it.
  await frame.evaluate(() => {
    ;(document.querySelector('[data-testid="play-screen"]') as HTMLElement).dataset.marker = 'first'
  })
}
const marker = (frame: Frame) =>
  frame.evaluate(
    () => (document.querySelector('[data-testid="play-screen"]') as HTMLElement | null)?.dataset.marker,
  )
const bridge = (page: Page, call: 'setMetrics' | 'setInputMode', payload: unknown) =>
  page.evaluate(
    ({ call, payload }) =>
      (window as unknown as { hostBridge: Record<string, (value: unknown) => void> }).hostBridge[call]?.(
        payload,
      ),
    { call, payload },
  )

test.describe('host events', () => {
  // Captures and settles in a software renderer, as the journeys.
  test.beforeEach(() => test.setTimeout(240_000))
  test('display.metrics moves the host’s strip from right to left mid-play; nothing remounts', async ({
    page,
  }, info) => {
    onlyIn(info, HOST_EVENT_CELLS)
    const cell = cellOf(info)
    const errors = await collectErrors(page)
    const frame = await open(page, 'fake-ruken', undefined)
    await playFrom(frame, cell)
    const { width, height } = cell.viewport
    const strip = (edge: 'left' | 'right') => ({
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
      hostReserved: { edge, rect: { x: edge === 'left' ? 0 : width - 72, y: 0, w: 72, h: height } },
      orientation: width > height ? 'landscape' : 'portrait',
      fullscreen: false,
      scale: 1,
    })
    const pauseBox = () => frame.getByTestId('pause').boundingBox()
    await bridge(page, 'setMetrics', strip('right'))
    await expect.poll(async () => (await pauseBox())?.x ?? width).toBeLessThanOrEqual(width - 72 - 44)
    await bridge(page, 'setMetrics', strip('left'))
    await expect.poll(async () => (await pauseBox())?.x ?? 0).toBeGreaterThan(width - 72 - 44)
    if (cell.device === 'touch') {
      const buttons = await frame.getByTestId('touch-buttons').boundingBox()
      expect(buttons?.x ?? 0).toBeGreaterThanOrEqual(72 - 0.5)
    }
    expect(await marker(frame)).toBe('first')
    expect(errors).toEqual([])
  })

  test('input.mode reporting an Xbox-layout pad turns the controller prompts to Xbox’s', async ({
    page,
  }, info) => {
    onlyIn(info, HOST_EVENT_CELLS)
    const cell = cellOf(info)
    const errors = await collectErrors(page)
    // A pad whose id names no family: its prompts are the generic words until the host says otherwise.
    const pad = await FakePad.install(page, { id: 'USB Gamepad (STANDARD GAMEPAD Vendor: 0079)' })
    const frame = await open(page, 'fake-ruken', pad)
    await playFrom(frame, cell)
    if (cell.device === 'touch') await frame.getByTestId('pause').tap()
    else await frame.locator('body').press('Escape')
    await expect(frame.getByTestId('paused-screen')).toBeVisible()
    await frame.getByTestId('settings').click()
    await frame.getByTestId('settings-tab-controls').click()
    const jumpOnPad = frame.locator(`[data-control-row="${JUMP}"] [data-rebind="gamepad"]`)
    await expect(jumpOnPad).toBeVisible()
    await expect(jumpOnPad).not.toHaveText('A')
    await bridge(page, 'setInputMode', { mode: 'gamepad', gamepad: { layout: 'xbox', connected: true } })
    await expect(jumpOnPad).toHaveText('A')
    expect(errors).toEqual([])
  })

  test('going to the background releases a held key', async ({ page }, info) => {
    onlyIn(info, HOST_EVENT_CELLS)
    const errors = await collectErrors(page)
    const frame = await open(page, 'fake-ruken', undefined)
    await playFrom(frame, cellOf(info))
    await frame.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    // Right goes down and stays down (no keyup), and in the same task the page goes to the background and comes
    // back, so no tick runs between: a slow renderer's gap would otherwise walk the runner off the stage.
    await frame.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }))
      for (const state of ['hidden', 'visible']) {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
        document.dispatchEvent(new Event('visibilitychange'))
      }
    })
    try {
      // The background opens the pause menu (runtime lifecycle); back in play, the runner stays still although the
      // key is still down, and it is still on the stage: a jump shows.
      await expect(frame.getByTestId('paused-screen')).toBeVisible()
      await frame.getByTestId('resume').click()
      await expect(frame.getByTestId('play-screen')).toBeVisible()
      await frame.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      const stopped = await settled(frame)
      await page.keyboard.down('Space')
      await expect.poll(async () => (await shot(frame)).equals(stopped), { timeout: 60_000 }).toBe(false)
      await page.keyboard.up('Space')
    } finally {
      await frame.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' })))
    }
    expect(errors).toEqual([])
  })

  test('button 8 held reaches the host as a summon, and the game sees no action', async ({ page }, info) => {
    onlyIn(info, HOST_EVENT_CELLS)
    const errors = await collectErrors(page)
    const pad = await FakePad.install(page)
    const frame = await open(page, 'fake-ruken', pad)
    await playFrom(frame, cellOf(info))
    const before = await settled(frame)
    const summons = () =>
      page.evaluate(() =>
        (window as unknown as { hostTrace: () => string[] })
          .hostTrace()
          .filter((type) => type === 'host.summon'),
      )
    await pad.press('select')
    // Ruken's SDK polls every 50 ms and summons after 600 ms held.
    await expect.poll(async () => (await summons()).length, { timeout: 10_000 }).toBe(1)
    await pad.release('select')
    await expect(frame.getByTestId('play-screen')).toBeVisible()
    expect((await settled(frame)).equals(before)).toBe(true)
    expect(errors).toEqual([])
  })

  test('a focused text field with the keyboard up keeps the form factor and the screen', async ({
    page,
  }, info) => {
    onlyIn(info, HOST_EVENT_CELLS)
    const errors = await collectErrors(page)
    const frame = await open(page, 'fake-ruken', undefined)
    await playFrom(frame, cellOf(info))
    const formFactor = () => frame.evaluate(() => document.documentElement.dataset.formFactor)
    const before = await formFactor()
    // A game's own text field (a name entry), focused, and the keyboard over the lower part of the page.
    await frame.evaluate(() => {
      const field = document.createElement('input')
      field.type = 'text'
      field.setAttribute('aria-label', 'Name')
      document.querySelector('[data-testid="play-screen"]')?.append(field)
      field.focus()
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        get: () => ({
          width: innerWidth,
          height: innerHeight - 300,
          offsetTop: 0,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      })
      window.dispatchEvent(new Event('resize'))
    })
    await expect
      .poll(() => frame.evaluate(() => document.documentElement.hasAttribute('data-visual-inset')))
      .toBe(true)
    expect(await formFactor()).toBe(before)
    expect(await marker(frame)).toBe('first')
    expect(errors).toEqual([])
  })
})

// Failure cells (§9.1), in the desktop gamepad Chromium cell under the fake host.
const FAILURE_CELL = ['desktop-gamepad-chromium']

test.describe('failures', () => {
  test.beforeEach(() => test.setTimeout(240_000))
  test('the pad in use unplugged mid-play pauses with the reconnect message (M-b)', async ({
    page,
  }, info) => {
    onlyIn(info, FAILURE_CELL)
    const errors = await collectErrors(page)
    const pad = await FakePad.install(page)
    const frame = await open(page, 'fake-ruken', pad)
    await pad.tap('south')
    await expect(frame.getByTestId('play-screen')).toBeVisible()
    // The pad is the device in use.
    await pad.tap('dpadRight')
    await pad.unplug()
    await expect(frame.getByTestId('paused-screen')).toBeVisible()
    await expect(frame.getByTestId('paused-screen')).toContainText('Reconnect your controller')
    expect(errors).toEqual([])
  })

  test('a pad without the standard mapping is told once that it is not supported', async ({ page }, info) => {
    onlyIn(info, FAILURE_CELL)
    const errors = await collectErrors(page)
    const pad = await FakePad.install(page, { mapping: '', id: 'Odd Pad' })
    const frame = await open(page, 'fake-ruken', pad)
    const toast = frame.getByTestId('pad-unsupported')
    await expect(toast).toHaveText(/This controller isn’t supported yet/)
    // It goes after a few seconds, and the same pad plugged in again is not told twice.
    await expect(toast).toHaveCount(0, { timeout: 10_000 })
    await pad.unplug()
    await pad.connect()
    await pad.frames(10)
    await expect(toast).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('with saves refused, a rebind holds for the session', async ({ page }, info) => {
    onlyIn(info, FAILURE_CELL)
    const errors = await collectErrors(page)
    // No capability granted: the host refuses the settings write.
    const frame = await openHosted(page, URL, 'core-input-rebind', { grant: [] })
    await frame.locator('body').press('Enter')
    await expect(frame.getByTestId('play-screen')).toBeVisible()
    await frame.locator('body').press('Escape')
    await frame.getByTestId('settings').click()
    await frame.getByTestId('settings-tab-controls').click()
    await frame.locator(`[data-control-row="${JUMP}"] [data-rebind="keyboard"]`).click()
    await frame.locator('body').press('KeyK')
    await expect(frame.locator(`[data-control-row="${JUMP}"] [data-rebind="keyboard"]`)).toHaveText('K')
    await frame.locator('[data-testid="settings-screen"] [data-modal-close]').click()
    await frame.getByTestId('resume').click()
    await expect(frame.getByTestId('play-screen')).toBeVisible()
    await frame.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const landed = await settled(frame)
    await page.keyboard.down('KeyK')
    await expect.poll(async () => (await shot(frame)).equals(landed), { timeout: 60_000 }).toBe(false)
    await page.keyboard.up('KeyK')
    // What M4.4 left open (02 follow-up, "the Controls section's save-refused state"): the section cannot say the
    // save was refused. Only the warning in the console says so; it is not an error.
    expect(errors).toEqual([])
  })
})
