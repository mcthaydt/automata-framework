/// <reference types="vite/client" />
declare module 'virtual:automata/content' {
  import type { CompiledContentData } from '@mcthaydt/automata-runtime'
  export const content: CompiledContentData
  export const contentHash: string
}
