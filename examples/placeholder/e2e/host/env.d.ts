interface ImportMetaEnv {
  readonly VITE_GAME_ORIGIN?: string
  readonly VITE_GAME_PATH?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
