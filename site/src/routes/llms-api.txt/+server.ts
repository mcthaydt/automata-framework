import llms from 'virtual:framework/llms'
import { textFile } from '../../lib/text-file'

// The framework's API index, byte for byte: every export with its signature and doc comment (`pnpm api-index`).
export const prerender = true
export const GET = () => textFile(llms.api)
