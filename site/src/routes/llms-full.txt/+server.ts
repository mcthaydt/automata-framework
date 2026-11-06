import llms from 'virtual:framework/llms'
import { textFile } from '../../lib/text-file'

// The framework's API index, byte for byte: its documentation corpus and the whole reference (`pnpm api-index`).
export const prerender = true
export const GET = () => textFile(llms.full)
