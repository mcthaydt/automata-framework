import reference from 'virtual:framework/api'
import { getDocSections } from '../../data/docs-loader'
import { llmsIndex } from '../../data/llms'
import { textFile } from '../../lib/text-file'

export const prerender = true
export const GET = () => textFile(llmsIndex(getDocSections(), reference.version))
