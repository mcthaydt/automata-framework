// The in-page player (`@mcthaydt/automata-editor/kit/player`): compiles a game's own files, with no Node and no Vite,
// into a page that runs on the runtime packages a host carries. The Automata app plays a game with it on a phone, and
// the web editors can play a game the same way. It reads the game from a `ProjectStore` and returns files; it
// writes nothing.
export {
  type CompileDeps,
  type CompiledGame,
  compileGame,
  type PlayRefusal,
} from '../shared/kit/player/compile-game'
export { FRAMEWORK_PREFIX } from '../shared/kit/player/framework-packages'
export {
  RUNTIME_SPECIFIERS,
  type RuntimeEntry,
  type RuntimeManifest,
} from '../shared/kit/player/runtime-manifest'
export { scanSpecifiers } from '../shared/kit/player/vite-subset'
