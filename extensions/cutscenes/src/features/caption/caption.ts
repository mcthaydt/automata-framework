import type { Caption } from '../../shared/sim/cutscene.schema.ts'

// The caption's words. The script holds a line id; the game's line records say which locale key it speaks, and its
// message catalog has the words. A key is never shown to a player: a caption with no words shows nothing and is named in
// `missing`, so the component can report it.

/** What the caption needs of a line record. Narrative's `LineRecord` has it; cutscenes does not import narrative. */
export interface CaptionLine {
  readonly text: string
}

/** What to draw for the moment `t` (seconds into the cutscene), or null for nothing. */
export interface CaptionModel {
  readonly text: string
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
  const text = words(lines(up.line)?.text ?? '')
  return { text: text ?? '', missing: text === undefined ? up.line : undefined }
}
