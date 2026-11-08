import reference from 'virtual:framework/api'
import { getDocSections } from '../../features/docs/docs-loader'
import { llmsIndex } from '../../features/docs/llms'
import { textFile } from '../../shared/html/text-file'

export const prerender = true
export const GET = () => textFile(llmsIndex(getDocSections(), reference.version))
