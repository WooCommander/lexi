/**
 * Озвучка через Web Speech API (в Android WebView работает через системный TTS).
 * Язык берётся из кода языка справочника — ядро не знает конкретных языков,
 * таблица ниже лишь уточняет регион для самых частых кодов.
 */

const LOCALES: Record<string, string> = {
    en: 'en-US',
    ru: 'ru-RU',
    ro: 'ro-RO',
    uk: 'uk-UA',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    it: 'it-IT',
    pl: 'pl-PL',
}

/** `ro` → `ro-RO`; неизвестные коды (и уже полные вроде `pt-BR`) отдаём как есть. */
export const speechLocale = (code: string): string => {
    const normalized = code.trim().replace('_', '-')
    return LOCALES[normalized.toLowerCase()] ?? normalized
}

/** Подходящий голос: точное совпадение локали, иначе любой голос того же языка. */
export const pickVoice = <V extends { lang: string }>(voices: readonly V[], locale: string): V | undefined => {
    const wanted = locale.toLowerCase().replace('_', '-')
    const base = wanted.split('-')[0]
    return (
        voices.find(v => v.lang.toLowerCase().replace('_', '-') === wanted) ??
        voices.find(v => v.lang.toLowerCase().replace('_', '-').split('-')[0] === base)
    )
}

const synth = (): SpeechSynthesis | null =>
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
        ? window.speechSynthesis
        : null

export const Speech = {
    isSupported: (): boolean => synth() !== null,

    /** Произнести текст; предыдущая реплика прерывается. */
    speak(text: string, languageCode: string | undefined): void {
        const engine = synth()
        const value = text.trim()
        if (!engine || !value) return
        try {
            // cancel() прямо перед speak() на Android может «съесть» новую реплику — прерываем только настоящую
            if (engine.speaking || engine.pending) engine.cancel()
            const utterance = new SpeechSynthesisUtterance(value)
            if (languageCode) {
                const locale = speechLocale(languageCode)
                utterance.lang = locale
                const voice = pickVoice(engine.getVoices(), locale)
                if (voice) utterance.voice = voice
            }
            utterance.rate = 0.9
            engine.speak(utterance)
        } catch {
            // озвучка вспомогательная: сбой движка не должен ломать тренировку
        }
    },

    stop(): void {
        try {
            synth()?.cancel()
        } catch {
            // ignore
        }
    },
}
