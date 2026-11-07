export { default as SaveSlots } from '../app/screens/saves/SaveSlots.svelte'
export {
  defaultSlot,
  type SaveSlotActivity,
  type SaveSlotsCopy,
  type SaveSlotsView,
  type SaveSlotView,
  slotActionsOf,
} from '../app/screens/saves/save-slots'
export { default as AudioSection } from '../app/screens/settings/AudioSection.svelte'
export {
  AUDIO_BUSES,
  type AudioBus,
  type AudioCopy,
  type AudioSectionChange,
  type AudioValue,
} from '../app/screens/settings/audio-section'
export { default as ControlsSection } from '../app/screens/settings/ControlsSection.svelte'
export {
  type ControlsCopy,
  type ControlsRow,
  type ControlsState,
  type ControlsTouchMode,
  controlsMessage,
  type RebindDevice,
} from '../app/screens/settings/controls-section'
export { default as DisplaySection } from '../app/screens/settings/DisplaySection.svelte'
export {
  DISPLAY_QUALITIES,
  type DisplayCopy,
  type DisplayQuality,
} from '../app/screens/settings/display-section'
export { default as LanguageSection } from '../app/screens/settings/LanguageSection.svelte'
export { endonymOf, type LanguageCopy } from '../app/screens/settings/language-section'
export { default as SettingsScreen } from '../app/screens/settings/SettingsScreen.svelte'
export type { SettingsSection, SettingsTab } from '../app/screens/settings/settings-screen'
export { default as TouchSection } from '../app/screens/settings/TouchSection.svelte'
export type { TouchCopy } from '../app/screens/settings/touch-section'
export { default as VibrationSection } from '../app/screens/settings/VibrationSection.svelte'
export type { VibrationCopy } from '../app/screens/settings/vibration-section'
export { bootDeviceClass, classifyDevice, type DeviceClass } from '../shared/ui/browser/device-class'
export {
  enterFullscreen,
  fullscreenSupport,
  isFullscreen,
  onFullscreenChange,
} from '../shared/ui/browser/fullscreen'
export { installGlobalErrorHandlers } from '../shared/ui/browser/global-errors'
export { type BarSample, HiddenBrowserBar, isDuckDuckGo } from '../shared/ui/browser/hidden-browser-bar'
export { RETRY_DELAYS_MS, type RetryTimers, retryUrl, watchImage } from '../shared/ui/browser/image-retry'
export { type InputMethod, InputMethodTracker } from '../shared/ui/browser/input-method.svelte'
export {
  type FullscreenSupport,
  type GateInputs,
  type LandscapeGateState,
  landscapeGate,
} from '../shared/ui/browser/landscape-gate'
export { lockOverscroll, pastEdge } from '../shared/ui/browser/lock-overscroll'
export { reducedMotion } from '../shared/ui/browser/reduced-motion'
export { type Sleeper, sleepWhenHidden } from '../shared/ui/browser/sleep-when-hidden'
export { suppressPageGestures } from '../shared/ui/browser/suppress-page-gestures'
export { default as Button } from '../shared/ui/controls/Button.svelte'
export { default as IconButton } from '../shared/ui/controls/IconButton.svelte'
export { default as Slider } from '../shared/ui/controls/Slider.svelte'
export { default as Toggle } from '../shared/ui/controls/Toggle.svelte'
export { default as Dialog } from '../shared/ui/dialog/Dialog.svelte'
export { default as Modal } from '../shared/ui/dialog/Modal.svelte'
export type { ModalProps } from '../shared/ui/dialog/modal-props'
export { default as Sheet } from '../shared/ui/dialog/Sheet.svelte'
export type { LandscapeGateCopy, RotateHintCopy, RotateToastCopy } from '../shared/ui/display/display-copy'
export { default as LandscapeGate } from '../shared/ui/display/LandscapeGate.svelte'
export { default as RotateHint } from '../shared/ui/display/RotateHint.svelte'
export { default as RotateToast } from '../shared/ui/display/RotateToast.svelte'
export { interceptBackGesture, sendBack } from '../shared/ui/focus/back-gesture'
export {
  CURSOR_IDLE_MS,
  type CursorInput,
  CursorRunner,
  cursorHidden,
  type ScreenKind,
} from '../shared/ui/focus/cursor-policy'
export {
  arrowKeyNav,
  FocusNavigator,
  type NavDirection,
  PAD_FOCUS,
  padKeyEvents,
  scrollWithin,
  tabbables,
} from '../shared/ui/focus/focus-nav'
export { isTap, PAGE_SWIPE, releaseStep, WheelPager } from '../shared/ui/focus/page-swipe'
export {
  classifyFormFactor,
  type FormFactor,
  PHONE_LANDSCAPE_MAX_HEIGHT,
  PHONE_PORTRAIT_MAX_WIDTH,
} from '../shared/ui/geometry/form-factor'
export {
  applyGeometry,
  type Geometry,
  type GeometryInput,
  type HostDisplay,
  hostReservedInsets,
  type Insets,
  measureGeometry,
  type Rect,
} from '../shared/ui/geometry/geometry'
export {
  createGeometryOwner,
  type GeometryOwner,
  type GeometryOwnerOptions,
  type GeometryState,
  probeEnvSafeArea,
  SETTLE_DELAYS_MS,
  type Timers,
  type ViewportWindow,
} from '../shared/ui/geometry/geometry-owner.svelte'
export {
  COMPACT_MAX_HEIGHT,
  classifyHeightTier,
  type HeightTier,
  SHORT_MAX_HEIGHT,
} from '../shared/ui/geometry/height-tier'
export { default as ActionBar } from '../shared/ui/layout/ActionBar.svelte'
export {
  type ActionKind,
  type BarAction,
  type CollapseLevel,
  collapseLevel,
} from '../shared/ui/layout/action-bar'
export { default as CornerControls } from '../shared/ui/layout/CornerControls.svelte'
export { default as OptionGroup } from '../shared/ui/layout/OptionGroup.svelte'
export { default as PagedGrid } from '../shared/ui/layout/PagedGrid.svelte'
export { default as PagerDots } from '../shared/ui/layout/PagerDots.svelte'
export {
  fitColumns,
  fitShape,
  type GridBox,
  type GridPage,
  type GridShape,
  type PagedGridProps,
  type PageGroup,
  pageOf,
  paginate,
  tileSide,
  trimRows,
  wrapPage,
} from '../shared/ui/layout/paged-grid'
export { pagerMode } from '../shared/ui/layout/pager'
export { default as ScreenFrame } from '../shared/ui/layout/ScreenFrame.svelte'
export { default as ScrollList } from '../shared/ui/layout/ScrollList.svelte'
export { default as Split } from '../shared/ui/layout/Split.svelte'
export { splitMode } from '../shared/ui/layout/split'
export { default as Prompt } from '../shared/ui/prompts/Prompt.svelte'
export {
  keyLabel,
  type PadWord,
  type PromptBinding,
  type PromptCopy,
  type PromptDevice,
  type PromptGlyphs,
  type PromptView,
  padLabel,
  promptView,
  readKeyboardLayout,
} from '../shared/ui/prompts/prompt-label'
export { UI_SLOT_NAMES, type UiComponent, type UiSlotName } from '../shared/ui/slots/ui-slot'
export { default as BootFailurePanel } from '../shared/ui/status/BootFailurePanel.svelte'
export {
  BOOT_FAILURE_COPY_EN,
  type BootFailure,
  type BootFailureAction,
  type BootFailureCopy,
  type BootFailureState,
  type BootFailureViewModel,
  bootFailureView,
  type ErrorCode,
  type HostKind,
  withHostName,
} from '../shared/ui/status/boot-failure'
export { default as Chip } from '../shared/ui/status/Chip.svelte'
export { default as ErrorPanel } from '../shared/ui/status/ErrorPanel.svelte'
export type { ErrorAction } from '../shared/ui/status/error-panel'
export { default as LeaderboardPanel } from '../shared/ui/status/LeaderboardPanel.svelte'
export { default as LoaderOverlay } from '../shared/ui/status/LoaderOverlay.svelte'
export type {
  LeaderboardCopy,
  LeaderboardEntryView,
  LeaderboardView,
} from '../shared/ui/status/leaderboard-panel'
export { default as SaveStatus } from '../shared/ui/status/SaveStatus.svelte'
export {
  SAVE_STATUS_TONES,
  type SaveStatusCopy,
  type SaveStatusState,
  type SaveStatusTone,
} from '../shared/ui/status/save-status'
export { default as Toast } from '../shared/ui/status/Toast.svelte'
export { default as CameraDragSurface } from '../shared/ui/touch/CameraDragSurface.svelte'
export type { CameraDragSurfaceProps, DragTracker } from '../shared/ui/touch/camera-drag-surface'
export { default as SwipeSurface } from '../shared/ui/touch/SwipeSurface.svelte'
export type { PointerTracker, SwipeIndicatorView, SwipeSurfaceProps } from '../shared/ui/touch/swipe-surface'
export { default as TouchControls } from '../shared/ui/touch/TouchControls.svelte'
export type { TouchButtonSpec, TouchControlsProps, TouchStickSpec } from '../shared/ui/touch/touch-button'
export {
  nearestTarget,
  PointerLatch,
  STICKY_MARGIN_PX,
  StickyPointers,
  type TouchTarget,
} from '../shared/ui/touch/touch-controls'
