/**
 * Preview images ship as a JPEG fallback plus WebP at 640 px and at full width (scripts/encode-previews.ts),
 * so phones never download an image more than twice the size they draw it.
 */
const FULL_WIDTH: Record<string, number> = {
  'bodies-2d': 960,
  'double-jump': 1280, emberwick: 1280, 'hot-reload': 1280,
}

/** The WebP `srcset` for a preview given its JPEG path, e.g. `/previews/emberwick.jpg`. */
export function previewSrcset(jpeg: string): string {
  const base = jpeg.replace(/\.jpg$/, '')
  const width = FULL_WIDTH[base.split('/').pop()!]
  if (!width) throw new Error('Unknown preview ' + jpeg + '; run scripts/encode-previews.ts and list its width here')
  return `${base}-640.webp 640w, ${base}.webp ${width}w`
}

/** The preview image each gallery demo has, by demo slug; `ui-primitives` has none yet. */
const DEMO_PREVIEWS: Record<string, string> = {
  'base-2d': 'emberwick', 'bodies-2d': 'bodies-2d', 'hot-reload': 'hot-reload',
}

/** The JPEG path of a demo's preview image (the poster shown before Play), or undefined when it has none. */
export function demoPoster(slug: string): string | undefined {
  const name = DEMO_PREVIEWS[slug]
  return name ? `/previews/${name}.jpg` : undefined
}
