// The framework's own tooling, never a game: the website playground's frame checks that an example's default export
// is a defineGame result, as startGame does, without that check joining the umbrella's one import.
export { isDefinedGame } from './define-game.ts'
