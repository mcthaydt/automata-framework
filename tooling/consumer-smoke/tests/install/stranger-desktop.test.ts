import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, it } from 'vitest'
import { packAll, sh } from '#src/commands.ts'
import { missingDesktopTools, startTauriSession, type TauriSession } from '#src/desktop/webdriver.ts'
import { overridesYaml, packOverrides, strangerFolder } from '#src/stranger.ts'

// A stranger's desktop game, from an empty folder to a Linux app that opens: make a game for the `tauri` target,
// install it, build it, `ship prepare --target tauri`, then start the .deb's app on a screen with no monitor and play
// the first run through the real webview. The packs stand in for the registry, as in the web journey. It needs the
// Linux toolchain and a real build (minutes), so it runs by hand and in the desktop job, never in `pnpm check`:
//   pnpm --filter @automata/consumer-smoke test:desktop
// What it proves about the host: the app is Tauri's (not a browser); a save goes to the store file in the app's data
// folder, never to the page's storage, and reaches the disk on its own, so the app killed right after still has it;
// a second start reads it back; closing the window quits the app.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const GAME = 'my-game'
/** The identifier `create-game` writes into `ship.config.ts`; the app's data folder is named after it. */
const IDENTIFIER = 'dev.example.my-game'
/** The bundles `ship prepare --target tauri` copies to `dist-tauri/` on each OS (Tauri builds only for its own). */
const BUNDLES: Readonly<Partial<Record<NodeJS.Platform, readonly string[]>>> = {
  linux: [`${GAME}-0.1.0-linux-appimage.AppImage`, `${GAME}-0.1.0-linux-deb.deb`],
  darwin: [`${GAME}-0.1.0-macos-dmg.dmg`],
  win32: [`${GAME}-0.1.0-windows-msi.msi`, `${GAME}-0.1.0-windows-nsis.exe`],
}
/** A display number unlikely to be taken on a desktop or a runner. */
const DISPLAY = ':97'
const DRIVER = 'http://127.0.0.1:4444'

const onPath = (tool: string): boolean => {
  try {
    execFileSync('sh', ['-c', `command -v ${tool}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** The background programs this run started. */
const started: ChildProcess[] = []

/** Stops them, newest first, and waits for each to exit, so none still writes into a folder about to be removed. */
async function stopBackground(): Promise<void> {
  for (const child of started.splice(0).reverse()) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill()
    await exited
  }
}
afterAll(stopBackground)

/** Starts a program in the background with `env` added, on the virtual screen. */
function background(command: string, args: readonly string[], env: NodeJS.ProcessEnv = {}): ChildProcess {
  const child = spawn(command, args, { stdio: 'ignore', env: { ...process.env, DISPLAY, ...env } })
  started.push(child)
  return child
}

/** Resolves once `ready` answers true, or rejects naming `what` after `timeoutMs`. */
async function waitFor(
  what: string,
  ready: () => boolean | Promise<boolean>,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await ready())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/** The ids of the processes named after the game (Linux's process table; the app is started by tauri-driver). */
const appPids = (): number[] =>
  readdirSync('/proc')
    .filter((entry) => /^\d+$/.test(entry))
    .filter((pid) => {
      try {
        return readFileSync(`/proc/${pid}/comm`, 'utf8').trim() === GAME
      } catch {
        return false // it exited while being read
      }
    })
    .map(Number)

const appRunning = (): boolean => appPids().length > 0

/** The store file's contents, or null while it has not been written. */
const readSaves = (file: string): unknown =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null

/** A timed step: its seconds go to the log, which is the run's record. */
async function step<A>(name: string, run: () => A | Promise<A>): Promise<A> {
  const start = Date.now()
  const result = await run()
  console.log(`${name}: ${((Date.now() - start) / 1000).toFixed(1)} s`)
  return result
}

it('a stranger makes a desktop game, builds the app, and on Linux it opens, saves to its store and reads it back', async () => {
  const linux = process.platform === 'linux'
  if (linux) expect(missingDesktopTools(onPath), 'tools the journey needs that are not installed').toEqual([])

  const folder = strangerFolder()
  const toolsDir = join(folder, 'tools')
  const gameDir = join(folder, 'work', GAME)
  let finished = false
  try {
    const overrides = await step('pack', () => packOverrides(folder, packAll(root, folder)))

    await step('make a game', () => {
      mkdirSync(toolsDir, { recursive: true })
      writeFileSync(join(toolsDir, 'package.json'), JSON.stringify({ name: 'stranger-tools', private: true }))
      writeFileSync(join(toolsDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
      sh(toolsDir, 'pnpm', ['add', overrides['@automata/tools'] as string])
      mkdirSync(join(folder, 'work'), { recursive: true })
      sh(join(folder, 'work'), join(toolsDir, 'node_modules/.bin/automata'), [
        'create-game',
        GAME,
        '--targets',
        'tauri',
      ])
      expect(readFileSync(join(gameDir, 'ship.config.ts'), 'utf8')).toContain(IDENTIFIER)
    })

    await step('install it', () => {
      writeFileSync(join(gameDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
      sh(gameDir, 'pnpm', ['install', '--no-frozen-lockfile'])
    })

    await step('build the web part', () => sh(gameDir, 'pnpm', ['build:tauri']))
    await step('build the desktop app (ship prepare --target tauri)', () =>
      sh(gameDir, 'pnpm', ['prepare:tauri']),
    )

    const out = join(gameDir, 'dist-tauri')
    const bundles = readdirSync(out).sort()
    expect(bundles).toEqual(BUNDLES[process.platform])
    for (const bundle of bundles) console.log(`${bundle}: ${statSync(join(out, bundle)).size} bytes`)
    if (!linux) {
      // Opening needs a WebDriver for the system webview: WebKitWebDriver on Linux, Edge's driver on Windows, and
      // none on macOS (WKWebView has no WebDriver). Until those are wired, macOS and Windows prove the build only.
      console.log(`opening the app is proved on Linux only; ${process.platform} proved the build`)
      finished = true
      return
    }

    // The app as the .deb installs it, unpacked rather than installed, so the run needs no root.
    const unpacked = join(folder, 'deb')
    sh(folder, 'dpkg-deb', ['-x', join(out, `${GAME}-0.1.0-linux-deb.deb`), unpacked])
    const app = join(unpacked, 'usr/bin', GAME)

    // A screen, a window manager, and the driver. The app's data, cache and config folders live in the stranger's
    // folder, so the run starts from nothing and leaves nothing in the home folder.
    const xdg = {
      XDG_DATA_HOME: join(folder, 'xdg/data'),
      XDG_CONFIG_HOME: join(folder, 'xdg/config'),
      XDG_CACHE_HOME: join(folder, 'xdg/cache'),
    }
    background('Xvfb', [DISPLAY, '-screen', '0', '1280x800x24'])
    await waitFor('the virtual screen', () => existsSync(`/tmp/.X11-unix/X${DISPLAY.slice(1)}`))
    background('openbox', [])
    background('tauri-driver', [], xdg)
    await waitFor('tauri-driver', () =>
      fetch(`${DRIVER}/status`).then(
        () => true,
        () => false,
      ),
    )

    const savesFile = join(xdg.XDG_DATA_HOME, IDENTIFIER, 'saves.json')
    const open = (): Promise<TauriSession> => startTauriSession(app, { base: DRIVER })
    const ready = 'return document.documentElement.dataset.state === "ready"'
    const onTitle = 'return document.querySelector("[data-testid=title-screen]") !== null'

    // First start: the first-run language screen; the player picks Japanese, and the app is then killed.
    const first = await step('open the app', open)
    await first.until(ready, 30_000)
    // Tauri's bridge is in the page: this is the desktop app, not a browser showing the build.
    expect(await first.execute('return typeof window.__TAURI_INTERNALS__')).toBe('object')
    await first.execute('document.querySelector("[data-testid=first-language-ja]").click()')
    await first.until(onTitle, 10_000)
    // The pick is a save: nothing of it is in the page's storage (the device's first-run flags may be).
    const pageStorage = (await first.execute('return Object.keys(localStorage)')) as string[]
    expect(pageStorage.filter((key) => key.includes('locale') || key.startsWith('ruken:'))).toEqual([])

    // The save reaches the disk on its own, shortly after the change, with no Quit and no close: a crash, a kill or a
    // power cut after that moment loses nothing. The app is then killed, which runs none of its exit handlers.
    await step('the save reaches the disk without a close', () =>
      waitFor(
        'the save on disk',
        () => JSON.stringify(readSaves(savesFile)) === '{"automata.locale":"ja"}',
        5_000,
      ),
    )
    expect(appRunning(), 'the app is running before it is killed').toBe(true)
    for (const pid of appPids()) process.kill(pid, 'SIGKILL')
    await waitFor('the killed app to be gone', () => !appRunning())
    await first.end().catch(() => undefined)
    expect(readSaves(savesFile)).toEqual({ 'automata.locale': 'ja' })

    // Second start: the save is read back from the store; the game opens in Japanese without asking again.
    const second = await step('open the app again', open)
    await second.until(ready, 30_000)
    await second.until(onTitle, 10_000)
    expect(await second.execute('return document.documentElement.lang')).toBe('ja')

    // The player closes the window as a window manager does; the adapter holds the close, flushes, then quits.
    await step('close the window', async () => {
      expect(appRunning(), 'the app is running before its window is closed').toBe(true)
      sh(folder, 'wmctrl', ['-c', 'My Game'], { DISPLAY })
      await waitFor('the app to quit', () => !appRunning())
    })
    await second.end().catch(() => undefined)
    expect(readSaves(savesFile)).toEqual({ 'automata.locale': 'ja' })
    finished = true
  } finally {
    await stopBackground()
    // A failed run keeps its folder for a look; a passing one leaves nothing behind. The webview's helper processes
    // outlive the app for a moment and still write Mesa's shader cache into it (ENOTEMPTY): rm retries for that.
    if (finished) rmSync(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    else console.log(`the stranger folder, kept: ${folder}`)
  }
})
