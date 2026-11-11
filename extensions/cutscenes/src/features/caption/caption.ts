import type { Caption } from '../../shared/sim/cutscene.schema.ts'

// The caption's words. The script holds a line id; the game's line records say which locale key it speaks, and its
// message catalog has the words. A key is never shown to a player: a caption with no words shows nothing and is named in
// `missing`, so the component can report it.

/** What the caption needs of a line record. Narrative's `LineRecord` has it; cutscenes does not import narrative. */
export interface CaptionLine {
  readonly text: string
  /** How the line is said, when its record says (narrative's `Delivery`, by shape): a pace or pauses type it out. */
  readonly delivery?: CaptionDelivery | undefined
}

/** The shape of narrative's delivery that the caption passes on; cutscenes names no narrative type. */
export interface CaptionDelivery {
  readonly how?: string | undefined
  readonly pace?: number | undefined
  readonly beats?: readonly { readonly after: number; readonly pause: number }[] | undefined
}

/** What to draw for the moment `t` (seconds into the cutscene), or null for nothing. */
export interface CaptionModel {
  readonly text: string
  /** Seconds since this caption came up. */
  readonly since: number
  readonly delivery: CaptionDelivery | undefined
  /** The line id of a caption that is up but has no words. */
  readonly missing: string | undefined
}

/** The caption up at `t`, with its words. */
export function captionModel(
  captions: readonly Caption[] | undefined,
  t: number,
  lines: (id: string) => CaptionLine | undefined,
  words: (key: string) => string | undefined,
): CaptionModel | null {
  const up = (captions ?? []).find((caption) => t >= caption.t && t < caption.until)
  if (up === undefined) return null
  const line = lines(up.line)
  const text = words(line?.text ?? '')
  return {
    text: text ?? '',
    since: t - up.t,
    delivery: line?.delivery,
    missing: text === undefined ? up.line : undefined,
  }
}
