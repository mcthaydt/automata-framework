// The viewport, layout and mounting fixtures, re-exported by `testing.ts`.
export { type MountedFixture, mountFixture } from '../testing/fixtures/mount'
export { type FakeResizeObserver, installFakeResizeObserver } from '../testing/fixtures/resize-observer'
export { textSnippet } from '../testing/fixtures/text-snippet'
export {
  type FakeViewportWindow,
  type FakeVisualViewport,
  fakeViewportWindow,
  hostDisplay,
} from '../testing/fixtures/viewport-window'
export {
  documentScrolls,
  findClipped,
  findCutAtSide,
  findIntrusions,
  findOffscreenControls,
  findOverlaps,
  findSmallTargets,
  findUnreachable,
  type LayoutRect,
  pressedPart,
  visibleControls,
} from '../testing/layout/assertions'
export {
  REFERENCE_SIZES,
  type ReferenceFormFactor,
  type ReferenceHeightTier,
  type ReferenceSize,
  TIGHT_SIZES,
  VARIANTS,
  type Variant,
} from '../testing/layout/reference-sizes'
