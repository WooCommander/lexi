import { TrainingDirection, type SrsState } from '../domain/Training'

/** Слово сложное, если ошибок минимум столько… */
export const DIFFICULT_MIN_WRONG = 2
/** …и они составляют не меньше этой доли ответов. */
export const DIFFICULT_MIN_WRONG_RATIO = 0.3

const DAY_MS = 24 * 60 * 60 * 1000

export const accuracy = (correct: number, wrong: number): number | null => {
    const total = correct + wrong
    return total > 0 ? correct / total : null
}

export const DifficultWordsService = {
    isDifficult(state: SrsState | null | undefined): boolean {
        if (!state) return false
        const total = state.correctAnswers + state.wrongAnswers
        return (
            state.wrongAnswers >= DIFFICULT_MIN_WRONG &&
            total > 0 &&
            state.wrongAnswers / total >= DIFFICULT_MIN_WRONG_RATIO
        )
    },

    /**
     * Приоритет при повторении: чем выше, тем раньше слово попадёт в тренировку.
     * Сложные слова получают заметную надбавку.
     */
    priority(state: SrsState | null | undefined, now: Date = new Date()): number {
        if (!state) return 0
        const overdueDays = state.nextReviewAt
            ? Math.max(0, (now.getTime() - new Date(state.nextReviewAt).getTime()) / DAY_MS)
            : 0
        const difficultBonus = DifficultWordsService.isDifficult(state) ? 10 : 0
        return difficultBonus + state.wrongAnswers * 2 - state.correctAnswers * 0.5 + Math.min(overdueDays, 30)
    },

    /** Направление, в котором ученик ошибается чаще. null — данных недостаточно. */
    weakerDirection(state: SrsState | null | undefined): TrainingDirection | null {
        if (!state) return null
        const fwd = accuracy(state.forwardCorrect, state.forwardWrong)
        const rev = accuracy(state.reverseCorrect, state.reverseWrong)
        if (fwd === null && rev === null) return null
        if (fwd === null) return TrainingDirection.Forward // прямое ещё не тренировали
        if (rev === null) return TrainingDirection.Reverse
        if (fwd === rev) return null
        return fwd < rev ? TrainingDirection.Forward : TrainingDirection.Reverse
    },

    /** Самые сложные слова первыми. */
    rank<T extends { progress: SrsState }>(entries: T[]): T[] {
        return entries
            .filter(e => DifficultWordsService.isDifficult(e.progress))
            .sort((a, b) => b.progress.wrongAnswers - a.progress.wrongAnswers ||
                a.progress.correctAnswers - b.progress.correctAnswers)
    },
}
