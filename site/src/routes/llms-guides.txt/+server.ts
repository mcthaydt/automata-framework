import { getDocSections } from '../../data/docs-loader'
import { llmsGuides } from '../../data/llms'
import { textFile } from '../../lib/text-file'

export const prerender = true
export const GET = () => textFile(llmsGuides(getDocSections()))
