import { describe, expect, it } from 'vitest'
import { compactNumber, niceAxis } from './numbers'

describe('compactNumber', () => {
    it('сокращает большие числа', () => {
        expect(compactNumber(0)).toBe('0')
        expect(compactNumber(999)).toBe('999')
        expect(compactNumber(1284)).toBe('1,3 тыс.')
        expect(compactNumber(12900)).toBe('13 тыс.')
        expect(compactNumber(1_200_000)).toBe('1,2 млн')
        expect(compactNumber(999_999)).toBe('1 млн')
        expect(compactNumber(999_400)).toBe('999 тыс.')
    })
})

describe('niceAxis', () => {
    it('даёт круглую верхнюю границу и шаг', () => {
        expect(niceAxis(7)).toEqual({ top: 8, step: 2 })
        expect(niceAxis(43)).toEqual({ top: 60, step: 20 })
        expect(niceAxis(100)).toEqual({ top: 100, step: 50 })
    })

    it('не ломается на нуле', () => {
        expect(niceAxis(0).top).toBeGreaterThan(0)
    })
})
