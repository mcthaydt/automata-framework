// The content editors, in the order the rail lists them. A suite page adds them after the core editors; the rail
// shows every one; an editor whose files the game lacks opens on a page that offers to start one.
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { type AudioOutput, silentAudio } from '../../features/audio/audio-output.ts'
import { createAudio } from '../../features/audio/audio-suite-editor.ts'
import type { StageOutputs } from '../../features/feel/feel-stage.ts'
import { createFeel } from '../../features/feel/feel-suite-editor.ts'
import { createSchematic } from '../../features/schematic/schematic-suite-editor.ts'
import { createSequence } from '../../features/sequence/sequence-suite-editor.ts'
import { createWriter } from '../../features/writer/writer-suite-editor.ts'

export interface ContentEditorOptions {
  /** What makes sound in the page; the page that cannot says so when Play is pressed. */
  readonly audio?: AudioOutput
  /** What a Feel stage can reach on the device (rumble). */
  readonly outputs?: StageOutputs
  /** The game's dev page, which Schematic shows beside its diagram (Watch); the editor server names it. */
  readonly gameUrl?: string | undefined
}

export function contentEditors(options: ContentEditorOptions = {}): SuiteEditor<unknown>[] {
  return [
    createFeel({
      ...(options.outputs === undefined ? {} : { outputs: options.outputs }),
      ...(options.audio === undefined ? {} : { audio: options.audio.play }),
    }),
    createAudio({ play: (options.audio ?? silentAudio).play }),
    createWriter(),
    createSequence(),
    createSchematic({ gameUrl: options.gameUrl }),
  ] as SuiteEditor<unknown>[]
}
