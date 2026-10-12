// Vite sets `import.meta.env.DEV` in dev builds. It is optional here because the runtime also loads
// in Node (the `./extension` entry), where `import.meta.env` does not exist.
interface ImportMetaEnv {
  readonly DEV?: boolean
}
interface ImportMeta {
  readonly env?: ImportMetaEnv
}
