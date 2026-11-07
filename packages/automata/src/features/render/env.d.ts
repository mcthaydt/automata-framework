// Vite sets `import.meta.env.DEV` in dev builds.
interface ImportMetaEnv {
  readonly DEV?: boolean
}
interface ImportMeta {
  readonly env?: ImportMetaEnv
}
