export { type MountedFixture, mountFixture } from './fixtures/mount'
export { type FakeResizeObserver, installFakeResizeObserver } from './fixtures/resize-observer'
export { textSnippet } from './fixtures/text-snippet'
export {
  type FakeViewportWindow,
  type FakeVisualViewport,
  fakeViewportWindow,
  hostDisplay,
} from './fixtures/viewport-window'
export {
  documentScrolls,
  findClipped,
  findIntrusions,
  findOffscreenControls,
  findOverlaps,
  findSmallTargets,
  findUnreachable,
  type LayoutRect,
} from './layout/assertions'
export {
  REFERENCE_SIZES,
  type ReferenceFormFactor,
  type ReferenceHeightTier,
  type ReferenceSize,
  VARIANTS,
  type Variant,
} from './layout/reference-sizes'
