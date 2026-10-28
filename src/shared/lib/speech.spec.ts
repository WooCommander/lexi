import { describe, expect, it } from 'vitest'
import { pickVoice, speechLocale } from './speech'

describe('speech', () => {
    it('maps language codes to locales and passes unknown codes through', () => {
        expect(speechLocale('en')).toBe('en-US')
        expect(speechLocale('RO')).toBe('ro-RO')
        expect(speechLocale('pt-BR')).toBe('pt-BR')
        expect(speechLocale('xx')).toBe('xx')
        expect(speechLocale('en_GB')).toBe('en-GB')
    })

    it('prefers an exact locale voice, then any voice of the same language', () => {
        const voices = [{ lang: 'en-GB' }, { lang: 'en-US' }, { lang: 'ru-RU' }]
        expect(pickVoice(voices, 'en-US')).toBe(voices[1])
        expect(pickVoice(voices, 'en-AU')).toBe(voices[0])
        expect(pickVoice(voices, 'ro-RO')).toBeUndefined()
        expect(pickVoice([{ lang: 'ru_RU' }], 'ru-RU')).toEqual({ lang: 'ru_RU' })
    })
})
