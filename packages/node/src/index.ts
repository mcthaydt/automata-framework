// @mcthaydt/automata-node: the Files and ProcessRunner Effect services AF's build-time packages share.
export { FileError, ProcessError } from './errors.ts'
export { Files, FilesLive, type FilesService } from './files.ts'
export {
  ProcessRunner,
  ProcessRunnerLive,
  type ProcessRunnerService,
  type RunOptions,
  type RunResult,
} from './process-runner.ts'
