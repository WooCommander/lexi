// Без похожих символов (0/O, 1/I/L), чтобы ребёнок не ошибся при вводе.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const PREFIX_BY_LANGUAGE: Record<string, string> = {
    en: 'ENG',
    ro: 'ROM',
    uk: 'UKR',
    ru: 'RUS',
}

export const invitePrefix = (languageCode?: string, kind: 'teacher' | 'parent' = 'teacher'): string => {
    if (kind === 'parent') return 'FAM'
    if (!languageCode) return 'LEX'
    return PREFIX_BY_LANGUAGE[languageCode] ?? languageCode.slice(0, 3).toUpperCase().padEnd(3, 'X')
}

/** Длина случайной части: 31^8 ≈ 8,5·10¹¹ вариантов — подбор перебором нереалистичен (прежние 4 знака — ≈ 9·10⁵). */
export const INVITE_CODE_LENGTH = 8

/** Криптостойкое случайное число [0, 1): код приглашения даёт доступ к группе, Math.random для этого слаб. */
const secureRandom = (): number => {
    const buffer = new Uint32Array(1)
    globalThis.crypto.getRandomValues(buffer)
    return buffer[0] / 2 ** 32
}

/** ENG-7K4P9XQ2 */
export const generateInviteCode = (prefix: string, random: () => number = secureRandom): string => {
    let body = ''
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) body += ALPHABET[Math.floor(random() * ALPHABET.length)]
    return `${prefix}-${body}`
}

export const normalizeInviteCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '')
