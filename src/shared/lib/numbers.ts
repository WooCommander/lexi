/** 1 284 → «1,3 тыс.», 12 900 → «12,9 тыс.», 1 200 000 → «1,2 млн». Ось и плитки читаются быстрее длинных чисел. */
export const compactNumber = (value: number): string => {
    const abs = Math.abs(value)
    const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '').replace('.', ',')
    // 999 999 при округлении до тысяч стало бы «1000 тыс.» — это уже миллион
    if (abs >= 999_500) return `${trim(value / 1_000_000)} млн`
    if (abs >= 10_000) return `${Math.round(value / 1000)} тыс.`
    if (abs >= 1000) return `${trim(value / 1000)} тыс.`
    return String(Math.round(value))
}

/** Верхняя граница оси: ближайшее «круглое» число (1, 2, 5 × 10ⁿ) не меньше максимума, и шаги делений. */
export const niceAxis = (max: number, ticks = 4): { top: number; step: number } => {
    if (!(max > 0)) return { top: ticks, step: 1 }
    const rough = max / ticks
    const magnitude = 10 ** Math.floor(Math.log10(rough))
    const normalized = rough / magnitude
    const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
    const step = factor * magnitude
    return { top: Math.ceil(max / step) * step, step }
}
