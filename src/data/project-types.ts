export interface SourceFile {
  /** Path relative to the framework repository. */
  path: string
  language: string
  /** Binary assets are listed with a repository link instead of decoded as text. */
  content?: string
}

export interface ExampleProject {
  slug: string
  root: string
  name: string
  command: string
  files: string[]
}

export interface ExampleSources {
  files: SourceFile[]
  projects: ExampleProject[]
}
