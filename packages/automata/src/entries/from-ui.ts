export { installGlobalErrorHandlers } from '../shared/ui/browser/global-errors'
export { reducedMotion } from '../shared/ui/browser/reduced-motion'
export { suppressPageGestures } from '../shared/ui/browser/suppress-page-gestures'
export { default as Button } from '../shared/ui/controls/Button.svelte'
export { default as IconButton } from '../shared/ui/controls/IconButton.svelte'
export { default as Slider } from '../shared/ui/controls/Slider.svelte'
export { default as Toggle } from '../shared/ui/controls/Toggle.svelte'
export { default as Dialog } from '../shared/ui/dialog/Dialog.svelte'
export { default as Modal } from '../shared/ui/dialog/Modal.svelte'
export { default as Sheet } from '../shared/ui/dialog/Sheet.svelte'
export {
  classifyFormFactor,
  type FormFactor,
} from '../shared/ui/geometry/form-factor'
export {
  type Geometry,
  measureGeometry,
} from '../shared/ui/geometry/geometry'
export {
  createGeometryOwner,
  type GeometryState,
  type ViewportWindow,
} from '../shared/ui/geometry/geometry-owner.svelte'
export {
  classifyHeightTier,
  type HeightTier,
} from '../shared/ui/geometry/height-tier'
export { default as ActionBar } from '../shared/ui/layout/ActionBar.svelte'
export type {
  ActionKind,
  BarAction,
} from '../shared/ui/layout/action-bar'
export { default as OptionGroup } from '../shared/ui/layout/OptionGroup.svelte'
export { default as PagedGrid } from '../shared/ui/layout/PagedGrid.svelte'
export { default as PagerDots } from '../shared/ui/layout/PagerDots.svelte'
export { default as ScreenFrame } from '../shared/ui/layout/ScreenFrame.svelte'
export { default as ScrollList } from '../shared/ui/layout/ScrollList.svelte'
export { default as Split } from '../shared/ui/layout/Split.svelte'
export { default as BootFailurePanel } from '../shared/ui/status/BootFailurePanel.svelte'
export { default as Chip } from '../shared/ui/status/Chip.svelte'
export { default as LeaderboardPanel } from '../shared/ui/status/LeaderboardPanel.svelte'
export { default as LoaderOverlay } from '../shared/ui/status/LoaderOverlay.svelte'
export { default as Toast } from '../shared/ui/status/Toast.svelte'
export { default as CameraDragSurface } from '../shared/ui/touch/CameraDragSurface.svelte'
export { default as TouchControls } from '../shared/ui/touch/TouchControls.svelte'
export { STICKY_MARGIN_PX } from '../shared/ui/touch/touch-controls'
