// Writer's session: the scenes of the game, the chosen scene's lines file and dialogue file (each a TOML session), what
// the person is looking at, and the things that touch more than one file: a choice is a line in one file and a choice in
// the other, and a line can be said by a conversation or a cutscene somewhere else. It outlives the view.
import { type ContentEdit, openDocument } from '@automata/editor/kit/documents'
import type { SuitePorts, WorkspaceFile } from '@automata/editor/kit/ports'
import {
  type Canon,
  DEFAULT_STANCE,
  type DialogueFile,
  type DialogueGraph,
  type DialogueNode,
  dialogueFileSchema,
  type LineKind,
  type LinesFile,
  linesFileSchema,
} from '@automata/narrative/sim'
import type { Cond, Value } from '@automata/puzzle/sim'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import { appendEdits } from '../../shared/fields.ts'
import { humanize } from '../../shared/id-words.ts'
import { type Outcome, openTomlSession } from '../../shared/toml-session.ts'
import { UndoTrail } from '../../shared/undo-many.ts'
import {
  addChoiceEdit,
  addConditionEdits,
  addPartEdit,
  choiceFactEdit,
  leadsTo,
  partIdOf,
  partWords,
  removeChoiceEdit,
  renamePartEdits,
  renameProblem,
  setNextEdit,
  setStanceEdit,
} from './dialogue-model.ts'
import { addLineEdits, newLineId, removeLineEdit, wordsEdit } from './writer-model.ts'
import { wayOut } from './writer-problems.ts'

export type WriterView = { readonly kind: 'lines' } | { readonly kind: 'talk'; readonly graph: number }

export interface SceneFiles {
  readonly lines: ContentSession<LinesFile, number>
  readonly dialogue: ContentSession<DialogueFile, string>
}

const LINES_EMPTY = '# What this scene says: one entry for each line.\n'
const DIALOGUE_EMPTY = '# The conversations of this scene.\n'

const SCENE_FILE = /^content\/(lines|dialogue)\/([^/]+)\.toml$/
const TRANSLATION_FILE = /^content\/messages\/([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)?)\.json$/
const CANON_FILE = /^content\/canon\/[^/]+\.toml$/
const CUTSCENE_FILE = /^content\/cutscenes\/([^/]+)\.toml$/

const joined = (names: readonly string[]): string =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`

export class WriterSession {
  readonly ports: SuitePorts
  readonly trail: UndoTrail = new UndoTrail()
  scenes: string[] = $state([])
  scene: string | undefined = $state()
  view: WriterView = $state({ kind: 'lines' })
  files: SceneFiles | undefined = $state.raw()
  /** The canon's people, when the game has a canon: speakers read as names. */
  people: Canon['people'] | undefined = $state.raw()
  stance: { readonly min: number; readonly max: number } = $state(DEFAULT_STANCE)
  /** The translations the game has (their language codes). */
  languages: readonly string[] = $state([])
  /** A change of words that translators have to catch up with, in words; until the next change. */
  note: string | undefined = $state()
  /** A line the person is about to remove while a conversation or cutscene still says it. */
  removing: { readonly index: number; readonly places: readonly string[] } | undefined = $state()

  readonly #cache = new Map<string, SceneFiles>()
  readonly #cutscenes: { readonly name: string; readonly path: string }[] = []

  private constructor(ports: SuitePorts) {
    this.ports = ports
  }

  static async open(listed: readonly WorkspaceFile[], ports: SuitePorts): Promise<WriterSession> {
    const session = new WriterSession(ports)
    const everything = await ports.workspace.files()
    const scenes = new Set<string>()
    for (const file of [...listed, ...everything]) {
      const found = SCENE_FILE.exec(file.path)
      if (found?.[2] !== undefined) scenes.add(found[2])
    }
    session.scenes = [...scenes].sort()
    session.languages = [
      ...new Set(everything.flatMap((file) => TRANSLATION_FILE.exec(file.path)?.[1] ?? [])),
    ].sort()
    for (const file of everything) {
      const cutscene = CUTSCENE_FILE.exec(file.path)
      if (cutscene?.[1] !== undefined)
        session.#cutscenes.push({ name: humanize(cutscene[1]), path: file.path })
    }
    await session.#readCanon(everything)
    const first = session.scenes[0]
    if (first !== undefined) await session.chooseScene(first)
    return session
  }

  async #readCanon(everything: readonly WorkspaceFile[]): Promise<void> {
    const people: Record<string, Canon['people'][string]> = {}
    const paths = new Set(everything.filter((file) => CANON_FILE.test(file.path)).map((file) => file.path))
    paths.add('content/canon/canon.toml')
    for (const path of paths) {
      const read = await this.ports.workspace.read(path)
      if (read === undefined) continue
      try {
        const value = openDocument(path, read.text).value() as Partial<Canon>
        Object.assign(people, value.people)
        if (value.stance !== undefined) this.stance = value.stance
      } catch {
        // A canon that does not parse is not Writer's to report; speakers then read from their ids.
      }
    }
    if (Object.keys(people).length > 0) this.people = people
  }

  async chooseScene(scene: string): Promise<void> {
    let files = this.#cache.get(scene)
    if (files === undefined) {
      const lines = await openTomlSession({
        path: `content/lines/${scene}.toml`,
        ports: this.ports,
        schema: linesFileSchema,
        empty: LINES_EMPTY,
      })
      const dialogue = await openTomlSession({
        path: `content/dialogue/${scene}.toml`,
        ports: this.ports,
        schema: dialogueFileSchema,
        empty: DIALOGUE_EMPTY,
      })
      this.trail.add(lines)
      this.trail.add(dialogue)
      files = {
        lines: new ContentSession(lines, 0, 'Start the lines of this scene'),
        dialogue: new ContentSession(dialogue, '', 'Start the conversations of this scene'),
      }
      this.#cache.set(scene, files)
    }
    this.scene = scene
    this.files = files
    this.view = { kind: 'lines' }
    this.removing = undefined
  }

  /** A scene with no files yet; its first line or conversation makes them. */
  async addScene(name: string): Promise<boolean> {
    const id = partIdOf(name)
    if (!this.scenes.includes(id)) this.scenes = [...this.scenes, id].sort()
    await this.chooseScene(id)
    return true
  }

  get graphs(): readonly DialogueGraph[] {
    return this.files?.dialogue.content?.graphs ?? []
  }

  /** The names used for people and parts: a canon name when there is one, else the id as words. */
  nameOf(speaker: string): string {
    return this.people?.[speaker]?.name ?? humanize(speaker)
  }

  // --- the conversations and cutscenes that still say a line -------------------------------------------------------

  async saidBy(lineId: string): Promise<string[]> {
    const places: string[] = []
    for (const graph of this.graphs) {
      const says = Object.values(graph.nodes).some(
        (node) => node.say.includes(lineId) || (node.choices ?? []).some((choice) => choice.line === lineId),
      )
      if (says) places.push(`the conversation ${this.nameOf(graph.speaker)}`)
    }
    for (const cutscene of this.#cutscenes) {
      const read = await this.ports.workspace.read(cutscene.path)
      if (read === undefined) continue
      try {
        const value = openDocument(cutscene.path, read.text).value() as { caption?: { line?: unknown }[] }
        if ((value.caption ?? []).some((caption) => caption.line === lineId))
          places.push(`the cutscene ${cutscene.name}`)
      } catch {
        // A cutscene that does not parse says nothing here.
      }
    }
    return places
  }

  // --- translations -------------------------------------------------------------------------------------------------

  #languageNames(): string {
    const display = new Intl.DisplayNames(['en'], { type: 'language' })
    return joined(this.languages.map((code) => display.of(code) ?? code))
  }

  #wordsChanged(): void {
    this.note = this.languages.length > 0 ? 'Translations of this line are now out of date.' : undefined
  }

  #lineCountChanged(): void {
    this.note =
      this.languages.length > 0
        ? `${this.#languageNames()} ${this.languages.length > 1 ? 'need' : 'needs'} this change before the game builds.`
        : undefined
  }

  // --- lines ---------------------------------------------------------------------------------------------------------

  /** A new line at the end of the scene's lines; resolves to its id. */
  async addLine(kind: LineKind, speaker: string | undefined, words: string): Promise<string | undefined> {
    const files = this.files
    const scene = this.scene
    if (files === undefined || scene === undefined || words.trim() === '') return undefined
    const taken = new Set((files.lines.content?.lines ?? []).map((line) => line.id))
    const id = newLineId(scene, words, taken)
    if (!files.lines.toml.exists()) {
      const started = await files.lines.start()
      if (!started.ok) return undefined
    }
    const outcome = await files.lines.change('Write a line', [
      ...addLineEdits(files.lines.content, { id, kind, speaker, words: words.trim() }),
    ])
    if (!outcome.ok) return undefined
    this.#lineCountChanged()
    return id
  }

  async setWords(index: number, words: string): Promise<Outcome> {
    const files = this.files
    const before = files?.lines.content?.lines[index]
    if (files === undefined || before === undefined) return { ok: false, message: 'That line is gone.' }
    const edit = wordsEdit(index, before.words, words.trim())
    if (edit === undefined) return { ok: true }
    const outcome = await files.lines.change('Change the words', [edit], `words.${String(index)}`)
    if (outcome.ok) this.#wordsChanged()
    return outcome
  }

  /** Asks first when a conversation or cutscene still says the line: sets `removing`; `force` removes anyway. */
  async removeLine(index: number, force = false): Promise<void> {
    const files = this.files
    const line = files?.lines.content?.lines[index]
    if (files === undefined || line === undefined) return
    const places = await this.saidBy(line.id)
    if (places.length > 0 && !force) {
      this.removing = { index, places }
      return
    }
    this.removing = undefined
    const outcome = await files.lines.change('Remove a line', [removeLineEdit(index)])
    if (outcome.ok) this.#lineCountChanged()
  }

  // --- conversations -------------------------------------------------------------------------------------------------

  /** A conversation with one empty part to start from. */
  async addConversation(speaker: string): Promise<boolean> {
    const files = this.files
    const scene = this.scene
    if (files === undefined || scene === undefined) return false
    const taken = new Set(this.graphs.map((graph) => graph.id))
    let id = `${scene}.${partIdOf(speaker)}`
    for (let n = 2; taken.has(id); n += 1) id = `${scene}.${partIdOf(speaker)}_${String(n)}`
    if (!files.dialogue.toml.exists() && !(await files.dialogue.start()).ok) return false
    const graph = { id, speaker, start: 'start', nodes: { start: { say: [] } } }
    const outcome = await files.dialogue.change(
      'Start a conversation',
      appendEdits(['graphs'], files.dialogue.content?.graphs !== undefined, graph),
    )
    if (outcome.ok) this.view = { kind: 'talk', graph: this.graphs.length - 1 }
    return outcome.ok
  }

  #graph(index: number): DialogueGraph | undefined {
    return this.graphs[index]
  }

  async addPart(graph: number, name: string): Promise<string | undefined> {
    const conversation = this.#graph(graph)
    if (conversation === undefined) return undefined
    const id = partIdOf(name)
    const problem = renameProblem(conversation, '', name)
    if (problem !== undefined) {
      if (this.files !== undefined) this.files.dialogue.message = problem
      return undefined
    }
    const outcome = await this.files?.dialogue.change('Add a part', [addPartEdit(graph, id)])
    return outcome?.ok ? id : undefined
  }

  async renamePart(graph: number, from: string, name: string): Promise<string | undefined> {
    const conversation = this.#graph(graph)
    const dialogue = this.files?.dialogue
    if (conversation === undefined || dialogue === undefined) return undefined
    const problem = renameProblem(conversation, from, name)
    if (problem !== undefined) {
      dialogue.message = problem
      return problem
    }
    const to = partIdOf(name)
    if (to === from) return undefined
    const outcome = await dialogue.change('Rename a part', renamePartEdits(graph, conversation, from, to))
    return outcome.ok ? undefined : outcome.message
  }

  /** Where a part goes on to when it has no choices; `undefined` removes it. */
  async setThen(graph: number, part: string, next: string | undefined): Promise<void> {
    const node = this.#graph(graph)?.nodes[part]
    if (node === undefined) return
    const keyPath = ['graphs', graph, 'nodes', part, 'next']
    const edit: ContentEdit | undefined =
      next === undefined
        ? node.next === undefined
          ? undefined
          : { keyPath, remove: true }
        : node.next === undefined
          ? { keyPath, insert: next }
          : { keyPath, expected: node.next, set: next }
    if (edit !== undefined) await this.files?.dialogue.change('Change where this goes next', [edit])
  }

  /** A line a part says, after those it already says. */
  async addSay(
    graph: number,
    part: string,
    kind: LineKind,
    speaker: string | undefined,
    words: string,
  ): Promise<void> {
    const node = this.#graph(graph)?.nodes[part]
    if (node === undefined) return
    const id = await this.addLine(kind, speaker, words)
    if (id === undefined) return
    await this.files?.dialogue.change('Add a line to this part', [
      { keyPath: ['graphs', graph, 'nodes', part, 'say'], insert: id },
    ])
  }

  /**
   * A choice: the player's line in the lines file, then the choice in the dialogue file. Two files, so two undo steps
   * ("Write the player's line", then "Add a choice"). `target` names an existing part, or a new part's words.
   */
  async addChoice(
    graph: number,
    part: string,
    words: string,
    target: { readonly part: string } | { readonly newPart: string },
  ): Promise<boolean> {
    const files = this.files
    const conversation = this.#graph(graph)
    const node = conversation?.nodes[part]
    if (files === undefined || conversation === undefined || node === undefined || words.trim() === '')
      return false
    let next: string
    if ('part' in target) next = target.part
    else {
      const problem = renameProblem(conversation, '', target.newPart)
      if (problem !== undefined) {
        files.dialogue.message = problem
        return false
      }
      next = partIdOf(target.newPart)
    }
    const taken = new Set((files.lines.content?.lines ?? []).map((line) => line.id))
    const scene = this.scene as string
    const id = newLineId(scene, words, taken)
    if (!files.lines.toml.exists() && !(await files.lines.start()).ok) return false
    const wrote = await files.lines.change("Write the player's line", [
      ...addLineEdits(files.lines.content, { id, kind: 'dialogue', speaker: 'player', words: words.trim() }),
    ])
    if (!wrote.ok) return false
    this.#lineCountChanged()
    if (!('part' in target)) {
      const made = await files.dialogue.change('Add a part', [addPartEdit(graph, next, wayOut(conversation))])
      if (!made.ok) return false
    }
    const fresh = this.#graph(graph)?.nodes[part] ?? node
    const added = await files.dialogue.change('Add a choice', [
      addChoiceEdit(graph, part, fresh, { line: id, next }),
    ])
    return added.ok
  }

  /** Takes a part away, unless it is where the conversation starts or another part still leads to it. */
  async removePart(graph: number, part: string): Promise<void> {
    const conversation = this.#graph(graph)
    const dialogue = this.files?.dialogue
    if (conversation === undefined || dialogue === undefined) return
    if (conversation.start === part) {
      dialogue.message = 'This is where the conversation starts, so it stays.'
      return
    }
    const leading = Object.entries(conversation.nodes)
      .filter(([id, node]) => id !== part && leadsTo(node).includes(part))
      .map(([id]) => partWords(id))
    if (leading.length > 0) {
      dialogue.message = `${joined(leading)} still ${leading.length > 1 ? 'lead' : 'leads'} here. Change where ${leading.length > 1 ? 'they go' : 'it goes'} first.`
      return
    }
    await dialogue.change('Remove a part', [{ keyPath: ['graphs', graph, 'nodes', part], remove: true }])
  }

  async removeChoice(graph: number, part: string, index: number): Promise<void> {
    await this.files?.dialogue.change('Remove a choice', [removeChoiceEdit(graph, part, index)])
  }

  async setChoiceNext(graph: number, part: string, index: number, next: string): Promise<void> {
    const before = this.#graph(graph)?.nodes[part]?.choices?.[index]?.next
    if (before === undefined || before === next) return
    await this.files?.dialogue.change('Change where a choice goes', [
      setNextEdit(graph, part, index, before, next),
    ])
  }

  async setChoiceStance(graph: number, part: string, index: number, stance: number): Promise<void> {
    const before = this.#graph(graph)?.nodes[part]?.choices?.[index]?.stance
    const edit = setStanceEdit(graph, part, index, before, stance)
    if (edit !== undefined) await this.files?.dialogue.change('Change standing', [edit])
  }

  async setChoiceFact(
    graph: number,
    part: string,
    index: number,
    name: string,
    value: Value | undefined,
  ): Promise<void> {
    const set = this.#graph(graph)?.nodes[part]?.choices?.[index]?.set
    const edit = choiceFactEdit(graph, part, index, set, name, value)
    if (edit !== undefined) await this.files?.dialogue.change('Change what is remembered', [edit])
  }

  /** A part that is said only when `cond` holds. */
  async addCondition(graph: number, part: string, cond: Cond): Promise<boolean> {
    const node: DialogueNode | undefined = this.#graph(graph)?.nodes[part]
    if (node === undefined || this.files === undefined) return false
    return (await this.files.dialogue.change('Say this only if', addConditionEdits(graph, part, node, cond)))
      .ok
  }

  async removeCondition(graph: number, part: string, index: number): Promise<void> {
    const node: DialogueNode | undefined = this.#graph(graph)?.nodes[part]
    if (node?.when === undefined) return
    await this.files?.dialogue.change('Remove a condition', [
      node.when.length === 1
        ? { keyPath: ['graphs', graph, 'nodes', part, 'when'], remove: true }
        : { keyPath: ['graphs', graph, 'nodes', part, 'when', index], remove: true },
    ])
  }
}
