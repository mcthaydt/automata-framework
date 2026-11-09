// The field the look draws into: the short side is always the look's (180), the long side follows the stage's aspect,
// so a phone held upright at 390 × 844 draws 180 × 390 and a 16:9 stage 320 × 180. The letterbox's composite target
// holds it at resolution 1 and upscales it nearest-neighbour, whole pixels (render/letterbox/composite-target.ts).

/** The look's short side when a look names none. */
const SHORT: number = 180
/** The aspect before a stage has a size: 16:9, as the renderer's own placeholder. */
const FALLBACK_ASPECT: number = 16 / 9

/** The target's size in pixels for a stage of `stage` pixels. A stage with no area draws a 16:9 landscape field. */
export function targetSize(
  stage: { readonly width: number; readonly height: number },
  short: number = SHORT,
): { width: number; height: number } {
  if (!(stage.width > 0 && stage.height > 0))
    return { width: Math.round(short * FALLBACK_ASPECT), height: short }
  const long = Math.round((short * Math.max(stage.width, stage.height)) / Math.min(stage.width, stage.height))
  return stage.width >= stage.height ? { width: long, height: short } : { width: short, height: long }
}
