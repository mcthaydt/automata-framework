// Audio as a suite editor: `audio` in the editor list. It opens the first audio file the list hands it, or makes
// `content/audio/audio.toml` when the game has none. Play is the page's: it renders the sound in the page and plays it
// only when the person presses Play.
import { type AudioContent, audioSchema } from '@automata/audio-synth'
import { defineSuiteEditor, type SuiteEditor } from '@automata/editor/kit/ports'
import type { AudioPlay } from '../../shared/audio-play.ts'
import { gameEvents } from '../../shared/game-events.ts'
import { undoOf } from '../../shared/session-hooks.ts'
import { openTomlSession } from '../../shared/toml-session.ts'
import { canvas, panel, status } from './AudioRegions.svelte'
import { AudioSession } from './audio-session.svelte.ts'
import { trackFiles } from './music-model.ts'

export const AUDIO_PATH = 'content/audio/audio.toml'

const EMPTY = "# The game's sounds and music, and what plays when something happens.\n"

export function createAudio(options: { readonly play: AudioPlay }): SuiteEditor<AudioSession> {
  return defineSuiteEditor<AudioSession>({
    id: 'audio',
    label: 'Audio',
    icon: 'list',
    hue: 'color/ed/audio',
    async open(files, ports) {
      const path = files.find((file) => file.path.endsWith('.toml'))?.path ?? AUDIO_PATH
      const toml = await openTomlSession<AudioContent>({ path, ports, schema: audioSchema, empty: EMPTY })
      return new AudioSession(
        toml,
        options.play,
        await trackFiles(ports.workspace),
        await gameEvents(ports.workspace),
      )
    },
    regions: { panel, canvas, status },
    undo: (session) => undoOf(session.toml),
  })
}
