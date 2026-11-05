// @mcthaydt/automata-node: the Files and ProcessRunner Effect services AF's build-time packages share.
export { FileError, ProcessError, type TaggedErrorClass } from '../shared/node/errors.ts'
export { Files, FilesLive, type FilesService } from '../shared/node/files.ts'
export {
  ProcessRunner,
  ProcessRunnerLive,
  type ProcessRunnerService,
  type RunOptions,
  type RunResult,
} from '../shared/node/process-runner.ts'
