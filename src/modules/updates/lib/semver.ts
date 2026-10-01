/** Сравнение версий MAJOR.MINOR.PATCH: 1 — a новее, −1 — b новее, 0 — равны. */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('-')[0].split('.').map(Number)
    const pb = b.split('-')[0].split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        const x = pa[i] || 0
        const y = pb[i] || 0
        if (x > y) return 1
        if (x < y) return -1
    }
    return 0
}
