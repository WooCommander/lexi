export interface Language {
    id: string
    code: string
    name: string
    nativeName?: string
    /** Настраиваемое отображаемое название, например «Молдавский / румынский». */
    displayName?: string
    flag?: string
}

export interface LanguagePair {
    sourceLanguageId: string
    targetLanguageId: string
}

export interface LanguageRow {
    id: string
    code: string
    name: string
    native_name: string | null
    display_name: string | null
    flag: string | null
}

export const languageFromRow = (row: LanguageRow): Language => ({
    id: row.id,
    code: row.code,
    name: row.name,
    nativeName: row.native_name ?? undefined,
    displayName: row.display_name ?? undefined,
    flag: row.flag ?? undefined,
})

export const languageLabel = (lang: Language | undefined | null): string =>
    lang ? lang.displayName || lang.nativeName || lang.name : '—'

export const isSamePair = (a: LanguagePair, b: LanguagePair) =>
    a.sourceLanguageId === b.sourceLanguageId && a.targetLanguageId === b.targetLanguageId

/**
 * Какой язык пары ученик изучает. Родной язык (обычно русский) — язык перевода,
 * поэтому English → Русский и Русский → English оба относятся к английскому.
 * Если родного языка в паре нет — изучается исходный.
 */
export const studiedLanguageId = (pair: LanguagePair, nativeLanguageId: string | null | undefined): string => {
    if (nativeLanguageId && pair.sourceLanguageId === nativeLanguageId) return pair.targetLanguageId
    return pair.sourceLanguageId
}
