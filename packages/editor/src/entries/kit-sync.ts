// The headless half of keeping a game on GitHub (`@mcthaydt/automata-editor/kit/sync`): merging a file edited on both
// sides, the sync loop and its status line, and GitHub sign-in. It takes its network, keychain, timers and git engine
// as arguments, so the web editors and the Automata app share it; neither is the reference.

export { generatedFolders, generatedNote, isGeneratedPath } from '../shared/kit/sync/generated-files'
export {
  type GitEngine,
  type MergeAsk,
  OfflineError,
  type PullOutcome,
  type PushResult,
} from '../shared/kit/sync/git-engine'
export {
  type Clock,
  githubToken,
  type Http,
  type HttpResponse,
  type Secrets,
  SIGN_IN_WORDS,
  type SignInStep,
  signIn,
} from '../shared/kit/sync/github-sign-in'
export { keepBothName, type MergeOutcome, mergeFile, type Versions } from '../shared/kit/sync/merge-drivers'
export {
  type SyncHandle,
  type SyncOptions,
  startSync,
  type Timers,
  type Visibility,
} from '../shared/kit/sync/sync-loop'
export {
  STATUS_LINES,
  type StatusStore,
  type SyncState,
  type SyncStatus,
} from '../shared/kit/sync/sync-status'
