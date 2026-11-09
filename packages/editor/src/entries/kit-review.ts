// What the Review page needs from a host (`@mcthaydt/automata-editor/kit/review`): the changes waiting on GitHub for
// the person, with the editors each touches and how its checks went. The web editors and the Automata app both fill it.

export { type EditorRow, editorsTouched } from '../shared/kit/review/editors-touched'
export type { GithubApi, GithubResponse } from '../shared/kit/review/github-api'
export type { ChecksState, ReviewGame, WaitingChange } from '../shared/kit/review/review-port'
export { listWaiting, type WaitingGame } from '../shared/kit/review/waiting-changes'
