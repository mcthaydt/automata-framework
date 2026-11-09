// A GitHub repository in memory, for the tests of anything that keeps a game there (`@automata/editor/kit/testing/github`).
// Plain TypeScript, so a Node test runner can load it without the editors' components.
export {
  createFakeGitHubRest,
  type FakeGitHubRest,
  type FakeRestOptions,
} from '../testing/kit/fake-github-rest'
