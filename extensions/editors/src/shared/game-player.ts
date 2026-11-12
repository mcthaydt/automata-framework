// Whether the game's code has the part that plays what an editor makes. The content compiler reads only the folders of
// the kinds a game registers, so a dialogue file in a game without the narrative extension is dropped without a word:
// each editor checks once when it opens, from the game's own `package.json`, and says so on its start page and status
// line. It still edits: a person may be writing ahead of the code.
import type { SuiteWorkspace } from '@automata/editor/kit/ports'

/** The package that plays each editor's files, and the first thing a person reads when the game lacks it. */
export type PlayerEditor = 'feel' | 'audio' | 'writer' | 'sequence' | 'schematic'

export const PLAYERS: Readonly<Record<PlayerEditor, { readonly pkg: string; readonly first: string }>> = {
  feel: { pkg: '@automata/feel', first: "Your game can't show what the player feels yet." },
  audio: { pkg: '@automata/audio-synth', first: "Your game can't play sounds or music yet." },
  writer: { pkg: '@automata/narrative', first: "Your game can't show conversations yet." },
  sequence: { pkg: '@automata/cutscenes', first: "Your game can't play cutscenes yet." },
  schematic: { pkg: '@automata/systems', first: "Your game can't move characters that think yet." },
}

const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const

/** A manifest that is missing or cannot be read counts as having the player: nothing is known, so nothing is claimed. */
export async function gameHasPlayer(
  workspace: Pick<SuiteWorkspace, 'read'>,
  editor: PlayerEditor,
): Promise<boolean> {
  const manifest = await workspace.read('package.json')
  if (manifest === undefined) return true
  try {
    const json = JSON.parse(manifest.text) as Record<string, Record<string, unknown> | undefined>
    const { pkg } = PLAYERS[editor]
    return FIELDS.some((field) => {
      const deps = json[field]
      return typeof deps === 'object' && deps !== null && pkg in deps
    })
  } catch {
    return true
  }
}

/** The two sentences, in order: what the game cannot do, then why and what still works. */
export function noPlayerWords(editor: PlayerEditor): readonly [string, string] {
  return [
    PLAYERS[editor].first,
    "Its code doesn't have the part that plays them. You can still make them here, and they'll show once it does.",
  ]
}
