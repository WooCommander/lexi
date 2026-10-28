import { unzipSync, strFromU8 } from 'fflate'
import type { VocabularyItemInput } from '../domain/VocabularyItem'
import type { BulkParseResult } from './bulkParse'

/**
 * Импорт слов из таблиц: CSV/TSV и Excel (.xlsx). Чистая логика, без Vue и DOM —
 * файл читает компонент, сюда приходят текст или байты.
 *
 * Колонки по умолчанию: A — слово, B — перевод, C — транскрипция, D — как читается, E — пример, F — перевод примера.
 * Если первая строка — заголовок (слово / перевод / транскрипция / пример …), колонки берутся по названиям.
 */

export type Table = string[][]

/** Защита от случайной загрузки огромного файла. */
export const MAX_IMPORT_ROWS = 5000

// ---------- CSV ----------

const DELIMITERS = [';', '\t', ','] as const

/** Разделитель — тот, что чаще встречается вне кавычек в первых строках (Excel в RU-локали пишет «;»). */
export const detectDelimiter = (text: string): string => {
    const counts = new Map<string, number>(DELIMITERS.map(d => [d, 0]))
    let quoted = false
    let lines = 0
    for (const ch of text) {
        if (ch === '"') quoted = !quoted
        else if (!quoted && ch === '\n') {
            if (++lines >= 5) break
        } else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1)
    }
    let best: string = ';'
    let max = 0
    for (const d of DELIMITERS) {
        if (counts.get(d)! > max) {
            max = counts.get(d)!
            best = d
        }
    }
    return best
}

/** RFC 4180: кавычки, удвоенные кавычки, переводы строк внутри полей; BOM и CRLF допускаются. */
export const parseCsv = (input: string, delimiter?: string): Table => {
    const text = input.replace(/^﻿/, '')
    const sep = delimiter ?? detectDelimiter(text)
    const rows: Table = []
    let row: string[] = []
    let field = ''
    let quoted = false

    const endField = () => {
        row.push(field)
        field = ''
    }
    const endRow = () => {
        endField()
        rows.push(row)
        row = []
    }

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"'
                    i++
                } else quoted = false
            } else field += ch
        } else if (ch === '"' && field === '') quoted = true
        else if (ch === sep) endField()
        else if (ch === '\n') endRow()
        else if (ch === '\r') {
            if (text[i + 1] === '\n') i++
            endRow()
        } else field += ch
    }
    if (field !== '' || row.length) endRow()

    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean))
}

// ---------- XLSX ----------

const decodeEntities = (s: string): string =>
    s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
        if (e[0] === '#') {
            const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
            return Number.isFinite(code) ? String.fromCodePoint(code) : ''
        }
        return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] ?? ''
    })

/** Склеивает все <t> (в rich text строка разбита на фрагменты), игнорируя фонетические подсказки <rPh>. */
const textOf = (xml: string): string => {
    const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
    return [...clean.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => decodeEntities(m[1])).join('')
}

/** «AB12» → индекс колонки (A = 0). */
const columnIndex = (ref: string): number => {
    const letters = /^[A-Za-z]+/.exec(ref)?.[0].toUpperCase() ?? 'A'
    let n = 0
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
}

const attr = (tag: string, name: string): string | undefined =>
    new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]

const file = (files: Record<string, Uint8Array>, path: string): string | undefined => {
    const data = files[path]
    return data ? strFromU8(data) : undefined
}

/** Target связи — путь относительно xl/ (или абсолютный от корня архива); `..` и `.` сворачиваем. */
const resolvePath = (target: string): string => {
    const parts: string[] = []
    for (const part of (target.startsWith('/') ? target.slice(1) : `xl/${target}`).split('/')) {
        if (part === '..') parts.pop()
        else if (part && part !== '.') parts.push(part)
    }
    return parts.join('/')
}

/** Первый лист книги: ищем по workbook.xml и связям, иначе берём sheet1. */
const firstSheetPath = (files: Record<string, Uint8Array>): string | undefined => {
    const workbook = file(files, 'xl/workbook.xml')
    const rels = file(files, 'xl/_rels/workbook.xml.rels')
    const sheetTag = workbook && /<sheet\b[^>]*>/.exec(workbook)?.[0]
    const rid = sheetTag && (attr(sheetTag, 'r:id') ?? attr(sheetTag, 'id'))
    if (rid && rels) {
        for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
            if (attr(m[0], 'Id') === rid) {
                const target = attr(m[0], 'Target')
                const resolved = target && resolvePath(target)
                if (resolved && files[resolved]) return resolved
            }
        }
    }
    return Object.keys(files).find(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
}

/** Содержимое первого листа .xlsx как таблица строк. Бросает Error с понятным текстом. */
export const parseXlsx = (bytes: Uint8Array): Table => {
    let files: Record<string, Uint8Array>
    try {
        files = unzipSync(bytes, { filter: f => f.name.startsWith('xl/') && !f.name.includes('media/') })
    } catch {
        throw new Error('Файл не похож на Excel (.xlsx). Старый формат .xls сохраните как .xlsx или CSV.')
    }

    const sheetPath = firstSheetPath(files)
    const sheet = sheetPath && file(files, sheetPath)
    if (!sheet) throw new Error('В книге Excel не найден лист с данными.')

    const sharedXml = file(files, 'xl/sharedStrings.xml')
    const shared = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1])) : []

    const table: Table = []
    for (const rowMatch of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const cells: string[] = []
        let next = 0
        for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const attrs = cellMatch[1]
            const body = cellMatch[2] ?? ''
            const ref = attr(attrs, 'r')
            const col = ref ? columnIndex(ref) : next
            const type = attr(attrs, 't')
            const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1]

            let value = ''
            if (type === 'inlineStr') value = textOf(body)
            else if (type === 's') value = shared[Number(rawValue)] ?? ''
            else if (rawValue !== undefined) value = decodeEntities(rawValue)

            cells[col] = value.trim()
            next = col + 1
        }
        // дырки в строке (пустые ячейки) → пустые строки
        const row = Array.from(cells, c => c ?? '')
        if (row.some(Boolean)) table.push(row)
    }
    return table
}

// ---------- Таблица → слова ----------

type Field = 'source' | 'target' | 'sourceTranscription' | 'sourceReading' | 'exampleSource' | 'exampleTarget'

const HEADER_ALIASES: Record<Field, string[]> = {
    source: ['слово', 'word', 'source', 'term', 'исходное', 'язык 1'],
    target: ['перевод', 'translation', 'target', 'meaning', 'значение', 'язык 2'],
    sourceTranscription: ['транскрипция', 'transcription', 'произношение', 'pronunciation'],
    sourceReading: ['как читается', 'чтение', 'читается', 'по-русски', 'reading', 'русскими буквами'],
    exampleSource: ['пример', 'example', 'предложение', 'sentence'],
    exampleTarget: ['перевод примера', 'example translation', 'перевод предложения'],
}

const POSITIONAL: Field[] = ['source', 'target', 'sourceTranscription', 'sourceReading', 'exampleSource', 'exampleTarget']

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Карта «поле → колонка», если первая строка похожа на заголовок; иначе null. */
const detectHeader = (row: string[]): Map<Field, number> | null => {
    const map = new Map<Field, number>()
    row.forEach((cell, index) => {
        const name = norm(cell)
        for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
            if (aliases.includes(name) && !map.has(field)) map.set(field, index)
        }
    })
    return map.has('source') && map.has('target') ? map : null
}

export const tableToWords = (table: Table): BulkParseResult => {
    const items: VocabularyItemInput[] = []
    const errors: BulkParseResult['errors'] = []
    const seen = new Set<string>()
    let duplicates = 0

    const header = table.length ? detectHeader(table[0]) : null
    const columns = header ?? new Map<Field, number>(POSITIONAL.map((field, i) => [field, i]))
    const start = header ? 1 : 0

    const truncated = table.length - start > MAX_IMPORT_ROWS

    table.slice(start, start + MAX_IMPORT_ROWS).forEach((row, i) => {
        const line = start + i + 1
        const cell = (field: Field) => {
            const index = columns.get(field)
            return (index !== undefined ? row[index] : undefined)?.trim() || undefined
        }
        const source = cell('source')
        const target = cell('target')
        if (!source || !target) {
            errors.push({ line, text: row.filter(Boolean).join(' | ') })
            return
        }

        const key = `${source.toLowerCase()}|${target.toLowerCase()}`
        if (seen.has(key)) {
            duplicates++
            return
        }
        seen.add(key)

        items.push({
            sourceText: source,
            targetText: target,
            sourceTranscription: cell('sourceTranscription'),
            sourceReading: cell('sourceReading'),
            exampleSource: cell('exampleSource'),
            exampleTarget: cell('exampleTarget'),
        })
    })

    return { items, errors, duplicates, truncated }
}
