import { describe, expect, it } from 'vitest'
import { pickNewWords, wordKey } from './pickWords'

const w = (sourceText: string, targetText: string) => ({ sourceText, targetText })

describe('pickNewWords', () => {
    it('пропускает слова, которые уже есть в наборе, без учёта регистра и пробелов', () => {
        const { fresh, skipped } = pickNewWords([w('Apple', 'Яблоко'), w('dog', 'собака')], [w(' apple ', 'яблоко')])
        expect(fresh.map(x => x.sourceText)).toEqual(['dog'])
        expect(skipped).toBe(1)
    })

    it('убирает повторы среди выбранных', () => {
        const { fresh, skipped } = pickNewWords([w('cat', 'кошка'), w('CAT', 'кошка')], [])
        expect(fresh).toHaveLength(1)
        expect(skipped).toBe(1)
    })

    it('слово с другим переводом — это другое слово', () => {
        expect(wordKey(w('bank', 'банк'))).not.toBe(wordKey(w('bank', 'берег')))
        expect(pickNewWords([w('bank', 'берег')], [w('bank', 'банк')]).fresh).toHaveLength(1)
    })

    it('пустой выбор ничего не добавляет', () => {
        expect(pickNewWords([], [w('a', 'б')])).toEqual({ fresh: [], skipped: 0 })
    })
})
