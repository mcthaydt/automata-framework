import { examplesRunner } from '@mcthaydt/examples-runner'
import { defineConfig } from 'vite'

// Every example in this folder, served and built by the one runner (EX spec §5): `pnpm examples [name]`,
// `pnpm build:examples`.
export default defineConfig({ plugins: [examplesRunner({ root: import.meta.dirname })] })
