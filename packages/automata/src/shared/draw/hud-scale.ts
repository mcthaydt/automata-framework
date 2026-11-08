/**
 * How big a logical pixel is on this screen, which canvas text needs to stay readable: CSS px per logical px (the
 * letterbox's scale), device px per CSS px (the renderer's resolution) and the host's own scale hint (1.333 in
 * Ruken's TV mode).
 */
export interface HudScale {
  readonly cssPerLogical: number
  readonly devicePerCss: number
  readonly hostScale: number
}
