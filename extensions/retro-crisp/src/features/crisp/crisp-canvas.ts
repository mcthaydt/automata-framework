// Where a canvas goes for a crisp layout: whole device pixels, drawn pixelated. `crispCanvasStyle` is the CSS as data;
// `applyCrispLayout` sets it on a canvas, and the canvas's drawing buffer should be `frame` pixels (`resolution` a CSS px).

import type { CrispLayout } from './crisp-scale.ts'

export function crispCanvasStyle(layout: CrispLayout): Record<string, string> {
  return {
    width: `${layout.size[0]}px`,
    height: `${layout.size[1]}px`,
    marginLeft: `${layout.offset[0]}px`,
    marginTop: `${layout.offset[1]}px`,
    imageRendering: 'pixelated',
  }
}

/** Lays a canvas out for a crisp layout. */
export function applyCrispLayout(
  canvas: { readonly style: Record<string, string> },
  layout: CrispLayout,
): void {
  Object.assign(canvas.style, crispCanvasStyle(layout))
}
