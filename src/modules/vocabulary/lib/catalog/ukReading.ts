/**
 * Как украинское слово читается русскими буквами. Правила механические, поэтому чтение
 * считается автоматически — так оно одинаково для всех слов, а не «где автор не забыл».
 *
 *   і → и, и → ы, ї → йи, щ → шч, ґ → г, є → е (в начале слова и после гласной — йе), ' → ь
 *
 * Возвращает undefined, если слово и так читается по-русски правильно (нет особых букв).
 */
const VOWELS = 'аеєиіїоуюяэы'

const SPECIAL = /[іиїєщґ'’ʼ]/i

const MAP: Record<string, string> = {
    і: 'и',
    и: 'ы',
    ї: 'йи',
    щ: 'шч',
    ґ: 'г',
}

export const ukrainianReading = (word: string): string | undefined => {
    if (!SPECIAL.test(word)) return undefined

    let result = ''
    const lower = word.toLowerCase()
    for (let i = 0; i < lower.length; i++) {
        const ch = lower[i]
        if (ch === 'є') {
            const prev = lower[i - 1]
            result += prev === undefined || VOWELS.includes(prev) || prev === ' ' ? 'йе' : 'е'
        } else if (ch === "'" || ch === '’' || ch === 'ʼ') {
            result += 'ь'
        } else result += MAP[ch] ?? ch
    }
    return result
}
