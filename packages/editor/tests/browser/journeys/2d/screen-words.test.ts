import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/level-2d/main.css'
import { afterEach, describe, expect, it } from 'vitest'
import { IPAD_PROFILES } from '#src/testing/kit/ipad-profiles.ts'
import { arrived } from '#src/testing/kit/layout-sizes.ts'
import { type JourneyEditor, openJourneyEditor, press } from '#src/testing/level-2d/journey-editor.ts'

// The copy rule on the real screens (task 12.5, the grandma audit's section 7): what a person reads on each view of
// the 2D editor holds no package name, path or format word, and none of the words the audit found a person stumbles
// on. It reads the rendered text (`innerText`: what is on screen, not what is hidden) of every view and the Characters
// inspector's Settings tab, on an iPad in landscape, where every region is shown at once.

/** Each word with why it is not a person's: matched as a whole word, case-insensitively unless it is a name. */
const NOT_A_PERSONS_WORD: readonly (readonly [RegExp, string])[] = [
  [/editor-/i, 'a package name'],
  [/af2d/i, 'a format name'],
  [/\.json\b/i, 'a file format'],
  [/\bcheckout\b/i, 'a developer word'],
  [/\bPlus\b/, 'a product tier'],
  [/\bprojects?\b/i, 'a format word (it is a game)'],
  [/\bworkspaces?\b/i, 'a developer word'],
  [/\bentit(y|ies)\b/i, 'a format word (they are characters)'],
  [/\bIntGrid\b/i, 'a format word'],
  [/\btunables?\b/i, 'a developer word (it is a setting)'],
  [/\bchange sets?\b/i, 'a developer word'],
  [/\bgates?\b/i, 'a developer word'],
  [/\bpivot\b/i, 'a developer word'],
]

/** Every rule the text breaks, with the line it broke it on. */
function strayWords(where: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line) =>
      NOT_A_PERSONS_WORD.filter(([pattern]) => pattern.test(line)).map(
        ([pattern, why]) => `${where}: "${line.trim()}" has ${pattern} (${why})`,
      ),
    )
}

let editor: JourneyEditor | undefined
afterEach(async () => {
  await editor?.close()
  editor = undefined
})

describe.each(IPAD_PROFILES.filter((profile) => profile.name === 'ipad-pro-11-landscape'))(
  'the words on every 2D view at $name',
  (profile) => {
    it.each(['platformer', 'topdown-rpg'] as const)(
      'the %s template says nothing but a person’s words',
      async (template) => {
        editor = await openJourneyEditor(profile, template)
        const found: string[] = []
        for (const view of ['Level', 'Characters']) {
          await press('radio', view)
          await arrived()
          found.push(...strayWords(view, document.body.innerText))
        }
        await press('tab', 'Settings')
        await arrived()
        found.push(...strayWords('Characters, Settings', document.body.innerText))
        expect(found).toEqual([])
      },
    )
  },
)
