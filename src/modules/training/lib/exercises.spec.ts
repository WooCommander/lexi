import { describe, expect, it } from 'vitest'
import { buildChoiceSet, checkTypedAnswer, answerVariants, verdictToResult } from './exercises'
import { TrainingDirection, TrainingResult } from '../domain/Training'
import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'

const item = (id: string, source: string, target: string, sl = 'en', tl = 'ru'): VocabularyItem => ({
    id,
    sourceLanguageId: sl,
    targetLanguageId: tl,
    sourceText: source,
    targetText: target,
    createdBy: 'u',
    createdAt: '2026-10-02T00:00:00Z',
})

describe('checkTypedAnswer', () => {
    it('accepts exact answers, ignoring case, spaces and trailing punctuation', () => {
        expect(checkTypedAnswer('  Apple ', 'apple')).toBe('exact')
        expect(checkTypedAnswer('apple.', 'apple')).toBe('exact')
    })

    it('accepts any of several variants', () => {
        expect(answerVariants('яблоко, плод; фрукт')).toEqual(['яблоко, плод; фрукт', 'яблоко', 'плод', 'фрукт'])
        expect(checkTypedAnswer('плод', 'яблоко, плод')).toBe('exact')
    })

    it('counts a missing diacritic or ё as close (still correct)', () => {
        expect(checkTypedAnswer('mar', 'măr')).toBe('close')
        expect(checkTypedAnswer('елка', 'ёлка')).toBe('close')
        expect(verdictToResult('close')).toBe(TrainingResult.Correct)
    })

    it('flags a single typo in a longer word as unsure', () => {
        expect(checkTypedAnswer('beutiful', 'beautiful')).toBe('typo')
        expect(verdictToResult('typo')).toBe(TrainingResult.Unsure)
    })

    it('does not forgive typos in short words and rejects wrong or empty input', () => {
        expect(checkTypedAnswer('cot', 'cat')).toBe('wrong')
        expect(checkTypedAnswer('', 'cat')).toBe('wrong')
        expect(checkTypedAnswer('!!!', 'cat')).toBe('wrong')
        expect(verdictToResult('wrong')).toBe(TrainingResult.Wrong)
    })
})

describe('buildChoiceSet', () => {
    const pool = [
        item('1', 'apple', 'яблоко'),
        item('2', 'dog', 'собака'),
        item('3', 'cat', 'кошка'),
        item('4', 'house', 'дом'),
        item('5', 'tree', 'дерево'),
    ]

    it('returns the correct answer plus distinct distractors', () => {
        const set = buildChoiceSet({ item: pool[0], direction: TrainingDirection.Forward }, pool)!
        expect(set.options).toHaveLength(4)
        expect(set.options[set.correctIndex]).toBe('яблоко')
        expect(new Set(set.options).size).toBe(4)
    })

    it('uses the source side for the reverse direction', () => {
        const set = buildChoiceSet({ item: pool[0], direction: TrainingDirection.Reverse }, pool)!
        expect(set.options[set.correctIndex]).toBe('apple')
        expect(set.options).not.toContain('яблоко')
    })

    it('never mixes languages of the answer side', () => {
        const mixed = [...pool, item('6', 'măr', 'яблоко', 'ro', 'ru'), item('7', 'câine', 'собака', 'ro', 'ru')]
        const set = buildChoiceSet({ item: pool[0], direction: TrainingDirection.Reverse }, mixed)!
        expect(set.options.every(o => !['măr', 'câine'].includes(o))).toBe(true)
    })

    it('skips distractors that duplicate the correct answer', () => {
        const dup = [pool[0], item('9', 'fruit', 'Яблоко'), item('10', 'x', 'дом'), item('11', 'y', 'сад')]
        const set = buildChoiceSet({ item: pool[0], direction: TrainingDirection.Forward }, dup)!
        expect(set.options.filter(o => o.toLowerCase() === 'яблоко')).toHaveLength(1)
    })

    it('returns null when there are too few distractors', () => {
        expect(buildChoiceSet({ item: pool[0], direction: TrainingDirection.Forward }, pool.slice(0, 2))).toBeNull()
    })
})
