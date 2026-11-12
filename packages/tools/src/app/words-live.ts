import { Effect, Layer } from 'effect'
import { FilesLive } from '../shared/node/files.ts'
import { ShipConfigLoaderLive } from '../shared/node/ship-config-loader.ts'
import { WordsModelLive } from '../shared/node/words-model-live.ts'
import { runWords } from '../shared/words/run-words.ts'
import type { WordsOptions } from '../shared/words/words-args.ts'
import type { CliIo } from './cli-io.ts'

// `automata words` on the real files, `ship.config.ts` and translator. Its own file so `cli.ts` loads it only when the
// command runs.

/** Runs `automata words` with the real services. */
export const runWordsWithLiveServices = (options: WordsOptions, io: CliIo): Promise<number> =>
  Effect.runPromise(
    Effect.provide(runWords(options, io), Layer.mergeAll(FilesLive, WordsModelLive, ShipConfigLoaderLive)),
  )
