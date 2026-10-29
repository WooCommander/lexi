import { describe, expect, it } from 'vitest'
import { chunk, fetchAllRows } from './paginate'

const source = (n: number) => Array.from({ length: n }, (_, i) => i)

const fakePage = (rows: number[], calls: number[][] = []) => async (from: number, to: number) => {
    calls.push([from, to])
    return { data: rows.slice(from, to + 1), error: null }
}

describe('fetchAllRows', () => {
    it('собирает все страницы, а не только первую', async () => {
        const calls: number[][] = []
        const rows = await fetchAllRows(fakePage(source(2500), calls), 50_000, 1000)
        expect(rows).toHaveLength(2500)
        expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    })

    it('точно кратное размеру страницы число строк не зацикливается', async () => {
        const rows = await fetchAllRows(fakePage(source(2000)), 50_000, 1000)
        expect(rows).toHaveLength(2000)
    })

    it('пустой результат и ошибка', async () => {
        expect(await fetchAllRows(fakePage([]))).toEqual([])
        await expect(fetchAllRows(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
    })

    it('уважает общий лимит строк', async () => {
        const rows = await fetchAllRows(fakePage(source(5000)), 1500, 1000)
        expect(rows).toHaveLength(1500)
    })
})

describe('chunk', () => {
    it('режет список на части', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
        expect(chunk([], 3)).toEqual([])
    })
})
