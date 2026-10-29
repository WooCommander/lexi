/** PostgREST по умолчанию отдаёт не больше 1000 строк за запрос и молча обрезает остальное. */
export const PAGE_SIZE = 1000

export interface PageResult<T> {
    data: T[] | null
    error: unknown
}

/**
 * Забирает все строки запроса страницами. `page(from, to)` строит запрос с `.range(from, to)`;
 * порядок в запросе должен быть детерминированным (по уникальному ключу), иначе страницы пересекутся.
 * `maxRows` — защита от случайной выгрузки миллионов строк.
 */
export const fetchAllRows = async <T>(
    page: (from: number, to: number) => PromiseLike<PageResult<T>>,
    maxRows = 50_000,
    pageSize = PAGE_SIZE,
): Promise<T[]> => {
    const rows: T[] = []
    for (let from = 0; rows.length < maxRows; from += pageSize) {
        const { data, error } = await page(from, from + pageSize - 1)
        if (error) throw error
        const chunk = data ?? []
        rows.push(...chunk)
        if (chunk.length < pageSize) break
    }
    return rows.length > maxRows ? rows.slice(0, maxRows) : rows
}

/** Список id для `.in(...)` режем на части: длинный список упирается в лимит длины URL. */
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
    const result: T[][] = []
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
    return result
}
