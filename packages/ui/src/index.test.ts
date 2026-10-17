import { expect, test } from 'vitest'
import * as ui from './index'

// The public surface (M1.6 spec §3): what the runtime, games and the demo import.
test.each([
  // geometry (§3.1)
  'measureGeometry',
  'applyGeometry',
  'createGeometryOwner',
  'classifyFormFactor',
  'classifyHeightTier',
  // primitives (§3.4)
  'ScreenFrame',
  'CornerControls',
  'ActionBar',
  'ScrollList',
  'Dialog',
  'LoaderOverlay',
  'ErrorPanel',
  'BootFailurePanel',
  // boot failures and slots (§3.6, §3.7)
  'bootFailureView',
  'BOOT_FAILURE_COPY_EN',
  'UI_SLOT_NAMES',
  // focus (§3.5)
  'FocusNavigator',
  'tabbables',
  'arrowKeyNav',
  // browser hygiene (§3.9)
  'installGlobalErrorHandlers',
  'HiddenBrowserBar',
  'isDuckDuckGo',
  'lockOverscroll',
  'pastEdge',
  'suppressPageGestures',
  'sleepWhenHidden',
  'classifyDevice',
  'bootDeviceClass',
  'landscapeGate',
  'RETRY_DELAYS_MS',
  'retryUrl',
  'watchImage',
  'InputMethodTracker',
  'reducedMotion',
  // touch (M4.3)
  'TouchControls',
  'SwipeSurface',
  'PointerLatch',
  'StickyPointers',
  'nearestTarget',
  'STICKY_MARGIN_PX',
] as const)('exports %s', (name) => {
  expect(ui).toHaveProperty(name)
  expect((ui as Record<string, unknown>)[name]).toBeDefined()
})
