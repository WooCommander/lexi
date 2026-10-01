import type { VocabularyItemInput } from '../domain/VocabularyItem'

export interface BulkParseResult {
    items: VocabularyItemInput[]
    errors: { line: number; text: string }[]
    duplicates: number
}

// Порядок важен: сначала однозначные разделители, затем тире с пробелами
// (тире без пробелов встречается внутри слов: «well-known», «по-русски»).
const SEPARATORS: RegExp[] = [/\t/, /;/, /\s+[—–-]\s+/, /\s*=\s*/]

const splitLine = (line: string): [string, string] | null => {
    for (const sep of SEPARATORS) {
        const match = line.match(sep)
        if (!match || match.index === undefined) continue
        const left = line.slice(0, match.index).trim()
        const right = line.slice(match.index + match[0].length).trim()
        if (left && right) return [left, right]
    }
    return null
}

/**
 * Разбор массового ввода:
 *   apple - яблоко
 *   apple;яблоко
 *   măr;яблоко;[mɨr]       ← третья колонка — транскрипция
 * Работает для любой языковой пары.
 */
export const parseBulkWords = (text: string): BulkParseResult => {
    const items: VocabularyItemInput[] = []
    const errors: BulkParseResult['errors'] = []
    const seen = new Set<string>()
    let duplicates = 0

    text.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim()
        if (!line || line.startsWith('#')) return

        const parts = line.includes(';') ? line.split(';').map(p => p.trim()) : null
        const pair = parts && parts.length >= 2 && parts[0] && parts[1] ? ([parts[0], parts[1]] as [string, string]) : splitLine(line)

        if (!pair) {
            errors.push({ line: index + 1, text: line })
            return
        }

        const key = `${pair[0].toLowerCase()}|${pair[1].toLowerCase()}`
        if (seen.has(key)) {
            duplicates++
            return
        }
        seen.add(key)

        const transcription = parts && parts.length >= 3 && parts[2] ? parts[2] : undefined
        items.push({ sourceText: pair[0], targetText: pair[1], sourceTranscription: transcription })
    })

    return { items, errors, duplicates }
}
