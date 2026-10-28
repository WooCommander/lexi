import { describe, expect, it } from 'vitest'
import { TOPICS, parseTopicLines, type TopicWords } from './topics'
import { EN_WORDS } from './en'
import { RO_WORDS } from './ro'
import { UK_WORDS } from './uk'

const LANGUAGES: [string, TopicWords, { reading: 'all' | 'optional' }][] = [
    ['English', EN_WORDS, { reading: 'all' }],
    ['Română', RO_WORDS, { reading: 'all' }],
    // украинский читается по-русски почти как есть: «как читается» нужно только там, где можно ошибиться
    ['Українська', UK_WORDS, { reading: 'optional' }],
]

describe.each(LANGUAGES)('словарь каталога: %s', (_name, words, rules) => {
    it('содержит все темы', () => {
        expect(Object.keys(words).sort()).toEqual(TOPICS.map(t => t.id).sort())
    })

    it.each(TOPICS)('тема «$title»: формат строк и объём', topic => {
        const lines = (words[topic.id] ?? '')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
        const bad = lines.filter(l => {
            const [source, target] = l.split('|').map(p => p.trim())
            return !source || !target
        })
        expect(bad, `строки без слова или перевода: ${bad.join(' / ')}`).toEqual([])
        expect(lines.length, 'слишком мало слов в теме').toBeGreaterThanOrEqual(topic.min)

        const parsed = parseTopicLines(words[topic.id])
        const keys = parsed.map(w => w.sourceText.toLowerCase())
        const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i)
        expect(duplicates, 'повторы слов внутри темы').toEqual([])

        for (const w of parsed) {
            // служебные символы разметки в тексте слова недопустимы
            expect(w.sourceText).not.toMatch(/[|\n]/)
            expect(w.targetText).not.toMatch(/[|\n]/)
            if (rules.reading === 'all') {
                expect(w.sourceReading, `нет «как читается» у «${w.sourceText}»`).toBeTruthy()
                // чтение — русскими буквами
                expect(w.sourceReading).toMatch(/^[А-Яа-яЁё\s\-'’,.!?]+$/)
            }
        }
    })

    it('даёт достаточно слов для простых текстов', () => {
        const total = TOPICS.reduce((n, t) => n + parseTopicLines(words[t.id] ?? '').length, 0)
        expect(total).toBeGreaterThanOrEqual(480)
    })
})
