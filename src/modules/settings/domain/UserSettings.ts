export const DAILY_GOALS = [5, 10, 15, 20] as const

export interface UserSettings {
    userId: string
    /** Общая дневная цель — сколько разных слов повторить за день. */
    dailyGoal: number
    /** Цель по конкретному языку: { [languageId]: число }. */
    languageGoals: Record<string, number>
    sessionSize: number
    /** Язык перевода (родной). Нужен, чтобы понять, какой язык пары изучается. */
    nativeLanguageId: string | null
    /** null — доступны все языки; список задаёт родитель. */
    allowedLanguageIds: string[] | null
    allowPersonalWords: boolean
}

export interface UserSettingsRow {
    user_id: string
    daily_goal: number
    language_goals: Record<string, number> | null
    session_size: number
    native_language_id: string | null
    allowed_language_ids: string[] | null
    allow_personal_words: boolean
}

export const defaultSettings = (userId: string): UserSettings => ({
    userId,
    dailyGoal: 10,
    languageGoals: {},
    sessionSize: 10,
    nativeLanguageId: null,
    allowedLanguageIds: null,
    allowPersonalWords: true,
})

export const settingsFromRow = (row: UserSettingsRow): UserSettings => ({
    userId: row.user_id,
    dailyGoal: row.daily_goal,
    languageGoals: row.language_goals ?? {},
    sessionSize: row.session_size,
    nativeLanguageId: row.native_language_id,
    allowedLanguageIds: row.allowed_language_ids,
    allowPersonalWords: row.allow_personal_words,
})

export const settingsToRow = (s: UserSettings): UserSettingsRow => ({
    user_id: s.userId,
    daily_goal: s.dailyGoal,
    language_goals: s.languageGoals,
    session_size: s.sessionSize,
    native_language_id: s.nativeLanguageId,
    allowed_language_ids: s.allowedLanguageIds,
    allow_personal_words: s.allowPersonalWords,
})

export const isLanguageAllowed = (settings: UserSettings | null, languageId: string) =>
    !settings?.allowedLanguageIds || settings.allowedLanguageIds.includes(languageId)
