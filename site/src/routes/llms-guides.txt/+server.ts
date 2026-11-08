import { getDocSections } from '../../features/docs/docs-loader'
import { llmsGuides } from '../../features/docs/llms'
import { textFile } from '../../shared/html/text-file'

export const prerender = true
export const GET = () => textFile(llmsGuides(getDocSections()))
