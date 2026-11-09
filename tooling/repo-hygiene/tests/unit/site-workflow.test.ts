import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { type Workflow, workflowProblems } from '#src/workflow-invariants.ts'

// The website's workflow (task 21.1): a pull request builds and checks the site, only a push to main deploys, and with
// no host configured the deploy says so and passes, so the first deploy is the push after the Owner names a host.

const file = fileURLToPath(new URL('../../../../.github/workflows/site.yml', import.meta.url))
const text = readFileSync(file, 'utf8')
interface SiteWorkflow {
  readonly jobs: Record<
    string,
    {
      readonly if?: string
      readonly needs?: string
      readonly steps: readonly { readonly name?: string; readonly run?: string }[]
    }
  >
}
const workflow = parse(text) as SiteWorkflow

describe('the site workflow', () => {
  it('keeps the repository’s workflow rules', () => {
    expect(workflowProblems('site.yml', workflow as unknown as Workflow)).toEqual([])
  })

  it('builds and checks on a pull request, and deploys only after that build and never from a pull request', () => {
    expect(workflow.jobs.build?.steps.some((step) => step.run?.includes('check:site'))).toBe(true)
    expect(workflow.jobs.deploy?.needs).toBe('build')
    expect(workflow.jobs.deploy?.if).toContain("github.event_name != 'pull_request'")
  })

  it('says "No host configured yet." and passes while the host’s token is not set', () => {
    const deploy = workflow.jobs.deploy?.steps.find((step) => step.name === 'Deploy')
    expect(deploy?.run).toMatch(/-z "\$SITE_HOST_TOKEN"[\s\S]*No host configured yet\.[\s\S]*exit 0/)
  })
})
