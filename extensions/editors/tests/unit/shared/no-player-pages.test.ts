// @vitest-environment jsdom
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { createAudio } from '#src/features/audio/audio-suite-editor.ts'
import { createFeel } from '#src/features/feel/feel-suite-editor.ts'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'
import { createSequence } from '#src/features/sequence/sequence-suite-editor.ts'
import { createWriter } from '#src/features/writer/writer-suite-editor.ts'
import { noPlayerWords, PLAYERS, type PlayerEditor } from '#src/shared/game-player.ts'

// A game without the part that plays what an editor makes: the start page says so, in two sentences, and still offers
// Start. A game with it says nothing. The same goes for the status line (its first sentence only: the bar is one line).

import AudioCanvas from '#src/features/audio/AudioCanvas.svelte'
import AudioStatus from '#src/features/audio/AudioStatus.svelte'
import FeelCanvas from '#src/features/feel/FeelCanvas.svelte'
import FeelStatus from '#src/features/feel/FeelStatus.svelte'
import SchematicCanvas from '#src/features/schematic/SchematicCanvas.svelte'
import SchematicStatus from '#src/features/schematic/SchematicStatus.svelte'
import SequenceCanvas from '#src/features/sequence/SequenceCanvas.svelte'
import SequenceStatus from '#src/features/sequence/SequenceStatus.svelte'
import WriterCanvas from '#src/features/writer/WriterCanvas.svelte'
import WriterStatus from '#src/features/writer/WriterStatus.svelte'

type Editor = PlayerEditor

/** Opens an editor on a game that has (or has not) its player, and draws its start page and status line. */
async function show(editor: Editor, withPlayer: boolean) {
  const { ports } = await createMemoryPorts({
    files: {
      'package.json': JSON.stringify({ dependencies: withPlayer ? { [PLAYERS[editor].pkg]: '1' } : {} }),
    },
    classify: (path) => ({ path, editor, gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  const files = await ports.workspace.files(editor)
  switch (editor) {
    case 'feel': {
      const session = await createFeel().open(files, ports)
      render(FeelCanvas, { props: { session } })
      render(FeelStatus, { props: { session } })
      return
    }
    case 'audio': {
      const session = await createAudio({ play: async () => {} }).open(files, ports)
      render(AudioCanvas, { props: { session } })
      render(AudioStatus, { props: { session } })
      return
    }
    case 'writer': {
      const session = await createWriter().open(files, ports)
      render(WriterCanvas, { props: { session } })
      render(WriterStatus, { props: { session } })
      return
    }
    case 'sequence': {
      const session = await createSequence().open(files, ports)
      render(SequenceCanvas, { props: { session } })
      render(SequenceStatus, { props: { session } })
      return
    }
    case 'schematic': {
      const session = await createSchematic().open(files, ports)
      render(SchematicCanvas, { props: { session } })
      render(SchematicStatus, { props: { session } })
      return
    }
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

const START: Record<Editor, string> = {
  feel: 'Start a feel file',
  audio: 'Start an audio file',
  writer: 'Start writing',
  sequence: 'Add',
  schematic: 'Add a character',
}

describe.each(Object.keys(PLAYERS) as Editor[])('%s without its player', (editor) => {
  const [first, second] = noPlayerWords(editor)

  it('says what the game cannot do and why, and still offers to start', async () => {
    await show(editor, false)
    expect(screen.getAllByText(first as string).length).toBeGreaterThan(0)
    expect(screen.getByText(second as string)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: START[editor] }).length).toBeGreaterThan(0)
    expect(document.querySelector('a[href*="README"]')).toBeNull()
  })

  it('says nothing when the game has the player', async () => {
    await show(editor, true)
    expect(screen.queryByText(first as string)).toBeNull()
    expect(screen.queryByText(second as string)).toBeNull()
  })
})
