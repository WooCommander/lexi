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

/** ENG-7K4P */
export const generateInviteCode = (prefix: string, random: () => number = Math.random): string => {
    let body = ''
    for (let i = 0; i < 4; i++) body += ALPHABET[Math.floor(random() * ALPHABET.length)]
    return `${prefix}-${body}`
}

export const normalizeInviteCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '')
