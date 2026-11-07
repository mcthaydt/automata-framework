/**
 * ui/primitives: every ui primitive at every reference size, with no renderer.
 *
 * What it shows:
 * - ScreenFrame with CornerControls, a ScrollList and an ActionBar.
 * - A Dialog, the LoaderOverlay, and the boot failure panel.
 * - The M4 primitives: Split, OptionGroup, PagerDots, PagedGrid, Button, IconButton, Toggle, Slider, Chip, Modal,
 *   Sheet and Toast.
 * - Each is laid out by the geometry owner from what the window and a (fake) Ruken host report:
 *   the safe area, Ruken's reserved strip, the keyboard and TV scale.
 *
 * Controls: pick a primitive and a variant at the top. Each card is that primitive in a frame of
 * one reference size, from 360x640 to 1024x1366 and the phone held sideways at 780x270. Inside a
 * card, Tab and the arrow keys move focus as a player's keyboard or controller would. Open a card
 * on its own (its link) to see it full-window, and resize the window to watch the owner re-measure.
 *
 * Base: none (renderer-free). Packages: `@automata/framework` (`/testing` for
 * the reference sizes and Ruken's display-metrics fixture).
 */

import '@automata/framework/theme.css'
import {
  classifyFormFactor,
  classifyHeightTier,
  createGeometryOwner,
  installGlobalErrorHandlers,
  suppressPageGestures,
  type ViewportWindow,
} from '@automata/framework'
import { hostDisplay, REFERENCE_SIZES, VARIANTS, type Variant } from '@automata/framework/testing'
import { mount, unmount } from 'svelte'
import Frame from './src/Frame.svelte'
import Gallery from './src/Gallery.svelte'

export const PRIMITIVES = [
  'screen',
  'dialog',
  'loader',
  'error',
  'split',
  'options',
  'pager',
  'paged-grid',
  'controls',
  'chip',
  'modal',
  'sheet',
  'toast',
  'leaderboard',
] as const
export type Primitive = (typeof PRIMITIVES)[number]

const isPrimitive = (value: string | null): value is Primitive => PRIMITIVES.some((name) => name === value)

function variantNamed(name: string | null): Variant {
  return VARIANTS.find((variant) => variant.name === name) ?? (VARIANTS[0] as Variant)
}

/**
 * The real window, or the real window with a keyboard laid over its foot. A browser only opens the
 * keyboard for a focused text field, so the demo stands one in by shrinking the visual viewport the
 * owner reads, exactly as the keyboard would.
 */
function viewportFor(variant: Variant): { window: ViewportWindow; keyboard: () => number } {
  const keyboard = (): number =>
    variant.keyboard?.({
      name: 'window',
      width: window.innerWidth,
      height: window.innerHeight,
      formFactor: classifyFormFactor(window.innerWidth, window.innerHeight),
      heightTier: classifyHeightTier(window.innerHeight),
      group: 'boundary',
    }) ?? 0
  if (variant.keyboard === undefined) return { window, keyboard }
  const covered: ViewportWindow = {
    get innerWidth() {
      return window.innerWidth
    },
    get innerHeight() {
      return window.innerHeight
    },
    visualViewport: {
      get height() {
        return window.innerHeight - keyboard()
      },
      offsetTop: 0,
      addEventListener: (type, listener) => window.visualViewport?.addEventListener(type, listener),
      removeEventListener: (type, listener) => window.visualViewport?.removeEventListener(type, listener),
    },
    addEventListener: (type, listener) => window.addEventListener(type, listener),
    removeEventListener: (type, listener) => window.removeEventListener(type, listener),
  }
  return { window: covered, keyboard }
}

/** Fonts loaded and two frames drawn, so measured layout (the action bar's collapse) has settled. */
async function settled(): Promise<void> {
  await document.fonts.ready
  for (let frame = 0; frame < 2; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

/** One primitive, full-window, laid out by a real geometry owner, as a game would boot it. */
async function startFrame(
  target: HTMLElement,
  primitive: Primitive,
  variant: Variant,
): Promise<() => Promise<void>> {
  const root = document.documentElement
  const strip = variant.hostReserved
  const host =
    strip === undefined && variant.scale === undefined
      ? undefined
      : hostDisplay({ edge: strip?.edge ?? 'right', width: strip?.width ?? 0, scale: variant.scale ?? 1 })
  const viewport = viewportFor(variant)
  const owner = createGeometryOwner({ window: viewport.window, root, host })
  // Browser hygiene a game installs at boot: no page menus over the game, and a last-resort report.
  const releaseGestures = suppressPageGestures(document)
  const releaseErrors = installGlobalErrorHandlers(window, (errorClass) =>
    console.error(`uncaught ${errorClass}`),
  )
  const app = mount(Frame, {
    target,
    props: { primitive, geometry: owner.geometry, strip, keyboard: viewport.keyboard },
  })
  await settled()
  root.dataset.ready = ''
  return async () => {
    await unmount(app)
    owner.dispose()
    releaseGestures()
    releaseErrors()
    delete root.dataset.ready
  }
}

/** The gallery: the chosen primitive and variant in a card per reference size. */
async function startGallery(
  target: HTMLElement,
  primitive: Primitive,
  variant: Variant,
  url: URL,
): Promise<() => Promise<void>> {
  const app = mount(Gallery, {
    target,
    props: {
      primitives: PRIMITIVES,
      sizes: REFERENCE_SIZES,
      variants: VARIANTS.map((each) => each.name),
      initialShow: primitive,
      initialVariant: variant.name,
      // Each card loads this same page in frame mode. Not `new URL('./index.html', import.meta.url)`: Vite
      // bundles that as an asset copy, whose `./main.ts` is a 404 in the build.
      page: `${url.origin}${url.pathname}`,
    },
  })
  await settled()
  return async () => {
    await unmount(app)
  }
}

/** Starts the demo in `target` from the page URL: `?frame=<primitive>` draws one, otherwise the gallery. */
export function start(target: HTMLElement, url: URL): Promise<() => Promise<void>> {
  const frame = url.searchParams.get('frame')
  const variant = variantNamed(url.searchParams.get('variant'))
  if (isPrimitive(frame)) return startFrame(target, frame, variant)
  const show = url.searchParams.get('show')
  return startGallery(target, isPrimitive(show) ? show : 'screen', variant, url)
}

const app = document.getElementById('app')
if (app !== null) void start(app, new URL(window.location.href))
