import type { TranslationRequest } from './words-model.ts'

// The text the model is sent for one word. Pure, and the one place it is written, so a test can read exactly what is
// asked.

/** What the model is told about its job, whatever the word. */
export const WORDS_SYSTEM: string =
  'You translate the words of a small video game for the screen a player taps. Write the way a game in that language ' +
  'would label the control: short, plain and natural, with no explanation.'

const termLines = (terms: Readonly<Record<string, string>>): string =>
  Object.entries(terms)
    .map(([key, text]) => `${key}: ${text}`)
    .join('\n')

/** The request for one word: the language, the key, where it shows, the source text and the words already chosen. */
export function wordsPrompt(request: TranslationRequest): string {
  const parts = [
    `Translate this game text into the language with the tag "${request.lang}".`,
    `Key: ${request.key}`,
  ]
  if (request.note !== undefined) parts.push(`Note: ${request.note}`)
  parts.push(`Text:\n${request.source}`)
  if (Object.keys(request.terms).length > 0) {
    parts.push(
      `Words already chosen in this language. Use the same word for the same thing:\n${termLines(request.terms)}`,
    )
  }
  parts.push(
    'Keep every {placeholder} exactly as written, braces and name included: the game fills each one in. ' +
      'Answer with only the translation: no quotes, no key, no note.',
  )
  return parts.join('\n\n')
}
