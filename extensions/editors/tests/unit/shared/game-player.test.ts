import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { gameHasPlayer, noPlayerWords, PLAYERS } from '#src/shared/game-player.ts'

// A content file only plays if the game's code has the part that plays it. The editor says so, in words; it never
// refuses to edit, because a person may be writing ahead of the code.

async function workspaceWith(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({ path, editor: 'feel', gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  return ports.workspace
}
const manifest = (field: string, name: string) => ({
  'package.json': JSON.stringify({ [field]: { [name]: '1.0.0' } }),
})

describe('gameHasPlayer', () => {
  it.each(['dependencies', 'devDependencies', 'peerDependencies'])(
    'finds the player under %s',
    async (field) => {
      const workspace = await workspaceWith(manifest(field, '@automata/feel'))
      expect(await gameHasPlayer(workspace, 'feel')).toBe(true)
    },
  )

  it('is false when the game does not list the editor’s own package', async () => {
    const workspace = await workspaceWith(manifest('dependencies', '@automata/narrative'))
    expect(await gameHasPlayer(workspace, 'feel')).toBe(false)
    expect(await gameHasPlayer(workspace, 'writer')).toBe(true)
  })

  it('is true when the manifest is missing or cannot be read (nothing is known, so nothing is claimed)', async () => {
    expect(await gameHasPlayer(await workspaceWith({}), 'audio')).toBe(true)
    expect(await gameHasPlayer(await workspaceWith({ 'package.json': '{ not json' }), 'audio')).toBe(true)
  })

  it('names each editor’s own package', () => {
    expect(Object.fromEntries(Object.entries(PLAYERS).map(([id, player]) => [id, player.pkg]))).toEqual({
      feel: '@automata/feel',
      audio: '@automata/audio-synth',
      writer: '@automata/narrative',
      sequence: '@automata/cutscenes',
      schematic: '@automata/systems',
    })
  })
})

describe('noPlayerWords', () => {
  it('is the editor’s first sentence, then the one every editor shares', () => {
    expect(noPlayerWords('audio')).toEqual([
      "Your game can't play sounds or music yet.",
      "Its code doesn't have the part that plays them. You can still make them here, and they'll show once it does.",
    ])
    expect(noPlayerWords('feel')[0]).toBe("Your game can't show what the player feels yet.")
    expect(noPlayerWords('writer')[0]).toBe("Your game can't show conversations yet.")
    expect(noPlayerWords('sequence')[0]).toBe("Your game can't play cutscenes yet.")
    expect(noPlayerWords('schematic')[0]).toBe("Your game can't move characters that think yet.")
  })
})
