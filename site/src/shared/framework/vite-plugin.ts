import type { Plugin } from 'vite'
import { readApiIndex } from './api.ts'
import { readChangelog } from './changelog.ts'
import { demoList } from './demos.ts'
import { playgroundExamples } from './examples.ts'
import { siteFacts } from './facts.ts'
import { readGuides } from './guides.ts'
import { repositoryRoot } from './root.ts'

// The framework's files as the pages import them: `import guides from 'virtual:framework/guides'`. Each module is
// computed by a loader in this folder when Vite first asks for it, from the workspace as it is, so a page and the file
// it describes change in the same pull request (no sync, no pinned commit). One module per dataset, so a page carries
// only what it imports.

const MODULES = {
  guides: () => readGuides(),
  examples: () => playgroundExamples(),
  demos: () => demoList(),
  facts: () => siteFacts(),
  changelog: () => readChangelog(),
  api: () => readApiIndex().reference,
  'api-search': () => readApiIndex().search,
  llms: () => {
    const { llmsFull, llmsApi } = readApiIndex()
    return { full: llmsFull, api: llmsApi }
  },
} satisfies Record<string, () => unknown>

const PREFIX = 'virtual:framework/'
// Rollup's convention: a resolved virtual id starts with \0, so no other plugin tries to read it from disk.
const RESOLVED = `\0${PREFIX}`

export function frameworkData(): Plugin {
  return {
    name: 'automata-site:framework-data',
    resolveId(id) {
      return id.startsWith(PREFIX) && id.slice(PREFIX.length) in MODULES ? `\0${id}` : undefined
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return undefined
      const read = MODULES[id.slice(RESOLVED.length) as keyof typeof MODULES]
      return `export default ${JSON.stringify(read())}`
    },
    // In dev, a change to a guide, a demo's header or the API index reloads the page that shows it.
    configureServer(server) {
      server.watcher.add([
        `${repositoryRoot}docs/guides`,
        `${repositoryRoot}tooling/api-index/dist`,
        `${repositoryRoot}.changeset`,
      ])
    },
  }
}
