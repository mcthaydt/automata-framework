// The person's games, kept in this browser (`@automata/editor/web-games`).

export { default as GamesPage } from '../features/web-games/GamesPage.svelte'
export { openCopy, saveCopy } from '../features/web-games/game-copy'
export { gameId } from '../features/web-games/games-index'
export {
  type GameEntry,
  type GameFile,
  type LastOpened,
  openWebGames,
  type WebGames,
  type WebGamesEnv,
} from '../features/web-games/web-games'
