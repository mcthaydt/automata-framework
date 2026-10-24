import type { Diagnostic } from '../profile'
import { elementPath, note, problem, type ResolvedCheckContext } from './check-types'
import type { StageDocument } from './stage-document'
import { either, suggestNames } from './suggest'

// The names the stage uses (EDFF.1b, spec §10.7): asset aliases against the loaded art manifest (FloorFifty
// `validate/aliases.ts`), and the layers a set piece names against the layers the stage draws (`validate/set-pieces.ts`).
// An empty name is the shape check's finding, not an unknown one.

// -- the checks --------------------------------------------------------------------------------------------------

function checkAliases(document: StageDocument, known: ReadonlySet<string>): Diagnostic[] {
  const { platformAlias, theme } = document.value
  const used: { path: string; alias: string | undefined }[] = [
    { path: 'platformAlias', alias: platformAlias },
    { path: 'theme.backdropAlias', alias: theme.backdropAlias },
    { path: 'theme.lightAlias', alias: theme.lightAlias },
    { path: 'theme.previewAlias', alias: theme.previewAlias },
    { path: 'theme.ambienceAlias', alias: theme.ambienceAlias },
    ...theme.layers.map((layer, index) => ({
      path: `${elementPath(document.ids, 'layers', index)}.alias`,
      alias: layer.alias,
    })),
  ]
  return used.flatMap(({ path, alias }) => {
    if (alias === undefined || alias === '' || known.has(alias)) return []
    const suggestions = suggestNames(alias, known)
    const advice = suggestions.length === 0 ? '' : ` Did you mean ${either(suggestions)}?`
    return [problem('unknownAssetAlias', path, `"${alias}" is not in the art manifest.${advice}`)]
  })
}

function checkLayerNames(document: StageDocument): Diagnostic[] {
  const { layers, setPieces } = document.value.theme
  const drawn = new Set(layers.map((layer) => layer.alias))
  return setPieces.flatMap((piece, index) => {
    if (piece.kind !== 'swarm' && piece.kind !== 'weatherBurst') return []
    const path = elementPath(document.ids, 'setPieces', index)
    return (piece.layers ?? []).flatMap((name, position) =>
      name === '' || drawn.has(name)
        ? []
        : [
            problem(
              'unknownReference',
              `${path}.layers[${position}]`,
              `The ${piece.kind} piece at floor ${piece.floor} names "${name}", which this stage does not draw.`,
              'remove-name',
            ),
          ],
    )
  })
}

export function checkReferences(document: StageDocument, context: ResolvedCheckContext): Diagnostic[] {
  return [
    ...(context.aliases === undefined ? [] : checkAliases(document, context.aliases)),
    ...checkLayerNames(document),
    ...(context.aliases === undefined
      ? [note('aliasesUnchecked', '', 'No art manifest is loaded, so asset aliases are not checked.')]
      : []),
  ]
}
