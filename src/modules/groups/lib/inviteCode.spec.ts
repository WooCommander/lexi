import { describe, expect, it } from 'vitest'
import { generateInviteCode, INVITE_CODE_LENGTH, normalizeInviteCode } from './inviteCode'

describe('invite codes', () => {
    it('генерирует длинный код из безопасного алфавита (без 0/O, 1/I/L)', () => {
        const code = generateInviteCode('ENG')
        expect(code).toMatch(/^ENG-[A-HJKMNP-Z2-9]+$/)
        expect(code.split('-')[1]).toHaveLength(INVITE_CODE_LENGTH)
        expect(INVITE_CODE_LENGTH).toBeGreaterThanOrEqual(8)
    })

    it('даёт разные коды (случайность не фиксирована)', () => {
        const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode('FAM')))
        expect(codes.size).toBe(200)
    })

    it('нормализует ввод: регистр и пробелы', () => {
        expect(normalizeInviteCode('  eng-7k4p 9xq2 ')).toBe('ENG-7K4P9XQ2')
    })
})
