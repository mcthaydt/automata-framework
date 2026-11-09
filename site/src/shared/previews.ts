/**
 * Preview images ship as a JPEG fallback plus WebP at 640 px and at full width (scripts/encode-previews.ts),
 * so phones never download an image more than twice the size they draw it.
 */
import { pictureOf } from './pictures'

/** The WebP `srcset` for a preview given its JPEG path, e.g. `/previews/emberwick.jpg`. */
export function previewSrcset(jpeg: string): string {
  const base = jpeg.replace(/\.jpg$/, '')
  const width = pictureOf(base.split('/').pop()!).width
  return `${base}-640.webp 640w, ${base}.webp ${width}w`
}

/** The preview image each demo has, by demo slug; `primitives` has none yet. */
const DEMO_PREVIEWS: Record<string, string> = {
  emberwick: 'emberwick',
  'hot-reload': 'hot-reload',
}

/** The JPEG path of a demo's preview image (the poster shown before Play), or undefined when it has none. */
export function demoPoster(slug: string): string | undefined {
  const name = DEMO_PREVIEWS[slug]
  return name ? `/previews/${name}.jpg` : undefined
}
