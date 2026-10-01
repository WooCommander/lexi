import { describe, expect, it } from 'vitest'
import { parseBulkWords } from './bulkParse'

describe('parseBulkWords', () => {
    it('parses dash-separated lines', () => {
        const { items, errors } = parseBulkWords('apple - яблоко\ndog — собака\ncat – кошка')
        expect(errors).toEqual([])
        expect(items.map(i => [i.sourceText, i.targetText])).toEqual([
            ['apple', 'яблоко'],
            ['dog', 'собака'],
            ['cat', 'кошка'],
        ])
    })

    it('parses semicolon lines for any language, with optional transcription', () => {
        const { items } = parseBulkWords('măr;яблоко\ncâine;собака;[ˈkɨne]')
        expect(items[0]).toMatchObject({ sourceText: 'măr', targetText: 'яблоко' })
        expect(items[1]).toMatchObject({ sourceText: 'câine', targetText: 'собака', sourceTranscription: '[ˈkɨne]' })
    })

    it('keeps hyphens inside words', () => {
        const { items } = parseBulkWords('well-known - известный')
        expect(items[0]).toMatchObject({ sourceText: 'well-known', targetText: 'известный' })
    })

    it('reports bad lines, skips blanks/comments and dedupes', () => {
        const { items, errors, duplicates } = parseBulkWords('# unit 1\n\nhello\napple;яблоко\nApple;Яблоко')
        expect(items).toHaveLength(1)
        expect(duplicates).toBe(1)
        expect(errors).toEqual([{ line: 3, text: 'hello' }])
    })
})
