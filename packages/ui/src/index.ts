export {
  classifyFormFactor,
  type FormFactor,
  PHONE_LANDSCAPE_MAX_HEIGHT,
  PHONE_PORTRAIT_MAX_WIDTH,
} from './geometry/form-factor'
export {
  applyGeometry,
  type Geometry,
  type GeometryInput,
  type HostDisplay,
  hostReservedInsets,
  type Insets,
  measureGeometry,
  type Rect,
} from './geometry/geometry'
export {
  createGeometryOwner,
  type GeometryOwner,
  type GeometryOwnerOptions,
  type GeometryState,
  probeEnvSafeArea,
  SETTLE_DELAYS_MS,
  type Timers,
  type ViewportWindow,
} from './geometry/geometry-owner.svelte'
export {
  COMPACT_MAX_HEIGHT,
  classifyHeightTier,
  type HeightTier,
  SHORT_MAX_HEIGHT,
} from './geometry/height-tier'
