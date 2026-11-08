// A schema's complaint as a sentence a person can act on. Zod's own messages name types and keys ("Expected number,
// received string"); the editors show what the value must be instead. A check written for people (a schema's custom
// issue) keeps its words and only gains a capital and a full stop.
import type { z } from 'zod'

const KINDS: Readonly<Record<string, string>> = {
  number: 'a number',
  int: 'a whole number',
  string: 'text',
  array: 'a list',
  boolean: 'on or off',
  object: 'a group of settings',
}

const sentence = (text: string): string => {
  const trimmed = text.trim()
  const raised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(raised) ? raised : `${raised}.`
}

export function problemWords(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'too_big':
      if (issue.origin === 'number')
        return issue.inclusive
          ? `Must be ${String(issue.maximum)} or less.`
          : `Must be less than ${String(issue.maximum)}.`
      return `Must have at most ${String(issue.maximum)}.`
    case 'too_small':
      if (issue.origin === 'number')
        return issue.inclusive
          ? `Must be ${String(issue.minimum)} or more.`
          : `Must be more than ${String(issue.minimum)}.`
      if (Number(issue.minimum) === 1) return 'Must not be empty.'
      return `Must have at least ${String(issue.minimum)}.`
    case 'invalid_type':
      return `Must be ${KINDS[issue.expected] ?? issue.expected}.`
    case 'invalid_value':
      return `Must be one of: ${issue.values.map(String).join(', ')}.`
    case 'unrecognized_keys':
      return `This file does not use ${issue.keys.map((key) => `“${key}”`).join(', ')}.`
    default:
      return sentence(issue.message)
  }
}
