import { describe, expect, it } from 'vitest'
import { ukrainianReading } from './ukReading'

describe('ukrainianReading', () => {
    it('меняет особые украинские буквы на то, как они звучат', () => {
        expect(ukrainianReading('кіт')).toBe('кит')
        expect(ukrainianReading('син')).toBe('сын')
        expect(ukrainianReading('їжа')).toBe('йижа')
        expect(ukrainianReading('щастя')).toBe('шчастя')
        expect(ukrainianReading('вітати')).toBe('витаты')
        expect(ukrainianReading('ґанок')).toBe('ганок')
    })

    it('є после согласной — «е», в начале слова и после гласной — «йе»', () => {
        expect(ukrainianReading('єдність')).toBe('йеднисть')
        expect(ukrainianReading('моє')).toBe('мойе')
        expect(ukrainianReading('життя')).toBe('жыття')
        expect(ukrainianReading('сьогодні')).toBe('сьогодни')
    })

    it('апостроф даёт мягкий знак', () => {
        expect(ukrainianReading("сім'я")).toBe('симья')
    })

    it('слова без особых букв читаются по-русски — чтение не нужно', () => {
        expect(ukrainianReading('вода')).toBeUndefined()
        expect(ukrainianReading('дорога')).toBeUndefined()
    })
})
