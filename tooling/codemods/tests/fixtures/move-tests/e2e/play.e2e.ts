import { expect, test } from '@playwright/test'
import { b } from '#src/a/b.ts'

test('play', () => expect(b).toBe(1))
