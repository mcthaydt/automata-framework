// Signing in with GitHub on the web, and keeping a web game on GitHub, the page's side (`@automata/editor/kit/web-sync`).

export {
  createWebGitHubSession,
  githubApp,
  githubReady,
  type WebGitHubDeps,
  type WebGitHubSession,
} from '../shared/kit/sync/web-sign-in'
export { startWebSync, type WebSync, type WebSyncDeps } from '../shared/kit/sync/web-sync'
