import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { MAX_IMPORT_ROWS, detectDelimiter, parseCsv, parseXlsx, tableToWords } from './tableImport'

/** Минимальная книга .xlsx, собранная вручную: ровно то, что пишут Excel и LibreOffice. */
const makeXlsx = (sheetRows: string, sharedStrings?: string[]) => {
    const files: Record<string, Uint8Array> = {
        'xl/workbook.xml': strToU8(
            '<workbook><sheets><sheet name="Лист1" sheetId="1" r:id="rId7"/></sheets></workbook>',
        ),
        'xl/_rels/workbook.xml.rels': strToU8(
            '<Relationships><Relationship Id="rId7" Type="x" Target="worksheets/sheet2.xml"/></Relationships>',
        ),
        'xl/worksheets/sheet2.xml': strToU8(`<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`),
    }
    if (sharedStrings) {
        files['xl/sharedStrings.xml'] = strToU8(
            `<sst>${sharedStrings.map(s => `<si>${s.startsWith('<') ? s : `<t>${s}</t>`}</si>`).join('')}</sst>`,
        )
    }
    return zipSync(files)
}

describe('parseCsv', () => {
    it('auto-detects semicolons (Excel in RU locale), commas and tabs', () => {
        expect(detectDelimiter('a;b\nc;d')).toBe(';')
        expect(detectDelimiter('a,b\nc,d')).toBe(',')
        expect(detectDelimiter('a\tb\nc\td')).toBe('\t')
        expect(parseCsv('apple;яблоко\r\ndog;собака\r\n')).toEqual([
            ['apple', 'яблоко'],
            ['dog', 'собака'],
        ])
    })

    it('handles quotes, escaped quotes, delimiters and newlines inside fields, and BOM', () => {
        const csv = '﻿word,translation\n"a, b","say ""hi"""\n"multi\nline",x'
        expect(parseCsv(csv)).toEqual([
            ['word', 'translation'],
            ['a, b', 'say "hi"'],
            ['multi\nline', 'x'],
        ])
    })

    it('ignores quoted delimiters when detecting the separator and drops blank rows', () => {
        expect(detectDelimiter('"a;b;c;d",x')).toBe(',')
        expect(parseCsv('a,b\n\n,\nc,d')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ])
    })
})

describe('parseXlsx', () => {
    it('reads shared strings, inline strings, numbers and sparse cells from the first sheet', () => {
      const rows =
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>ex</t></is></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>42</v></c></row>' +
          '<row r="3"/>'
      const table = parseXlsx(makeXlsx(rows, ['măr', 'яблоко &amp; плод', '<r><t>fa</t></r><r><t>ncy</t></r>']))
      expect(table).toEqual([
          ['măr', 'яблоко & плод', '', 'ex'],
          ['fancy', '42'],
      ])
    })

    it('resolves relative and absolute sheet targets, falling back to any sheet', () => {
        const sheet = '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row>'
        const book = (target: string) =>
            zipSync({
                'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>'),
                'xl/_rels/workbook.xml.rels': strToU8(`<Relationships><Relationship Id="rId1" Target="${target}"/></Relationships>`),
                'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
            })
        expect(parseXlsx(book('../xl/worksheets/sheet1.xml'))).toEqual([['x']])
        expect(parseXlsx(book('/xl/worksheets/sheet1.xml'))).toEqual([['x']])
        expect(parseXlsx(book('worksheets/missing.xml'))).toEqual([['x']])
    })

    it('ignores phonetic runs in shared strings', () => {
        const table = parseXlsx(makeXlsx('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', ['<t>漢字</t><rPh sb="0" eb="1"><t>かんじ</t></rPh>']))
        expect(table).toEqual([['漢字']])
    })

    it('explains what is wrong with a file that is not xlsx', () => {
        expect(() => parseXlsx(strToU8('word;translation'))).toThrow(/xlsx/)
        expect(() => parseXlsx(zipSync({ 'xl/other.xml': strToU8('<a/>') }))).toThrow(/лист/)
    })
})

describe('tableToWords', () => {
    it('uses columns A–F when there is no header', () => {
        const { items, errors } = tableToWords([
            ['apple', 'яблоко', '/ˈæp.əl/', 'эпл', 'An apple', 'Яблоко'],
            ['dog', 'собака'],
        ])
        expect(errors).toEqual([])
        expect(items[0]).toEqual({
            sourceText: 'apple',
            targetText: 'яблоко',
            sourceTranscription: '/ˈæp.əl/',
            sourceReading: 'эпл',
            exampleSource: 'An apple',
            exampleTarget: 'Яблоко',
        })
        expect(items[1]).toMatchObject({ sourceText: 'dog', targetText: 'собака', sourceTranscription: undefined })
    })

    it('maps columns by header names in any order and skips the header row', () => {
        const { items, errors } = tableToWords([
            ['Перевод', 'Как читается', 'Слово'],
            ['яблоко', 'эпл', 'apple'],
        ])
        expect(errors).toEqual([])
        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({ sourceText: 'apple', targetText: 'яблоко', sourceReading: 'эпл' })
    })

    it('reports rows with a missing side by their sheet row number and dedupes', () => {
        const { items, errors, duplicates } = tableToWords([
            ['word', 'translation'],
            ['apple', 'яблоко'],
            ['hello', ''],
            ['Apple', 'Яблоко'],
        ])
        expect(items).toHaveLength(1)
        expect(duplicates).toBe(1)
        expect(errors).toEqual([{ line: 3, text: 'hello' }])
    })

    it('flags truncation when a file has more rows than the limit', () => {
        const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [`w${i}`, `t${i}`])
        const result = tableToWords(rows)
        expect(result.items).toHaveLength(MAX_IMPORT_ROWS)
        expect(result.truncated).toBe(true)
        expect(tableToWords(rows.slice(0, 3)).truncated).toBe(false)
    })

    it('does not mistake a normal first row for a header', () => {
        const { items } = tableToWords([['word', 'слово'], ['cat', 'кошка']])
        // «word» — заголовок только если найдены обе колонки; здесь нет «перевод/translation»
        expect(items.map(i => i.sourceText)).toEqual(['word', 'cat'])
    })
})
