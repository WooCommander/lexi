import { describe, expect, it } from 'vitest'
import { CATALOG_LANGUAGES, STARTER_SETS } from './starterSets'
import { TOPICS } from './catalog/topics'

describe('STARTER_SETS', () => {
    it('собирает набор для каждой пары язык × тема', () => {
        expect(STARTER_SETS).toHaveLength(CATALOG_LANGUAGES.length * TOPICS.length)
    })

    it('даёт уникальные id и названия (по названию определяется, что набор уже добавлен)', () => {
        expect(new Set(STARTER_SETS.map(s => s.id)).size).toBe(STARTER_SETS.length)
        expect(new Set(STARTER_SETS.map(s => s.name)).size).toBe(STARTER_SETS.length)
    })

    it('всегда идёт «изучаемый язык → русский», а язык различается', () => {
        for (const s of STARTER_SETS) {
            expect(s.targetCode).toBe('ru')
            expect(s.sourceCode).not.toBe(s.targetCode)
        }
    })

    it('включает украинский', () => {
        expect(STARTER_SETS.some(s => s.sourceCode === 'uk' && s.words.length > 0)).toBe(true)
    })
})
