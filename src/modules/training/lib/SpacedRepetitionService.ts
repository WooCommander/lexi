import { TrainingDirection, TrainingResult, WordLearningStatus, type SrsState } from '../domain/Training'

/**
 * Интервальное повторение. Не зависит ни от Vue, ни от конкретного языка —
 * работает с абстрактным состоянием SrsState.
 */

/** Лестница интервалов после правильных ответов (дни). */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const

/** С какого интервала слово считается изученным. */
export const LEARNED_INTERVAL_DAYS = 7

/** На сколько ступеней лестницы откатываемся после ошибки. */
const WRONG_STEP_BACK = 2

const DAY_MS = 24 * 60 * 60 * 1000

const stepIndex = (intervalDays: number): number => {
    // индекс последней ступени, не превышающей текущий интервал; −1 — ещё ни одной
    let index = -1
    REVIEW_INTERVALS.forEach((value, i) => {
        if (value <= intervalDays) index = i
    })
    return index
}

export const SpacedRepetitionService = {
    initialState(): SrsState {
        return {
            status: WordLearningStatus.New,
            correctAnswers: 0,
            wrongAnswers: 0,
            forwardCorrect: 0,
            forwardWrong: 0,
            reverseCorrect: 0,
            reverseWrong: 0,
            intervalDays: 0,
        }
    },

    nextInterval(currentDays: number): number {
        const next = REVIEW_INTERVALS[stepIndex(currentDays) + 1]
        return next ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]
    },

    /** Уменьшение интервала после ошибки: 30 → 7, 7 → 1, 3 → 0 (повторить сегодня). */
    reducedInterval(currentDays: number): number {
        const index = stepIndex(currentDays) - WRONG_STEP_BACK
        return index >= 0 ? REVIEW_INTERVALS[index] : 0
    },

    isDue(state: SrsState | null | undefined, now: Date = new Date()): boolean {
        if (!state || state.status === WordLearningStatus.New || !state.nextReviewAt) return true
        return new Date(state.nextReviewAt).getTime() <= now.getTime()
    },

    /**
     * Применить ответ.
     * isPractice — слово показано сверх плана (ещё не пришло время повторять):
     * счётчики обновляем, но интервал не продвигаем, чтобы не «перепрыгнуть» лестницу.
     * Ошибка всегда сокращает интервал.
     */
    applyAnswer(
        prev: SrsState | null | undefined,
        result: TrainingResult,
        direction: TrainingDirection,
        now: Date = new Date(),
        isPractice = false,
    ): SrsState {
        const state: SrsState = { ...(prev ?? SpacedRepetitionService.initialState()) }
        const correct = result === TrainingResult.Correct
        const forward = direction === TrainingDirection.Forward

        if (correct) {
            state.correctAnswers++
            if (forward) state.forwardCorrect++
            else state.reverseCorrect++
        } else {
            state.wrongAnswers++
            if (forward) state.forwardWrong++
            else state.reverseWrong++
        }

        state.lastReviewedAt = now.toISOString()

        if (correct && isPractice && state.status !== WordLearningStatus.New) {
            return state
        }

        if (correct) {
            state.intervalDays = SpacedRepetitionService.nextInterval(state.intervalDays)
        } else if (result === TrainingResult.Unsure) {
            // «Сомневаюсь»: интервал не растёт и не падает, но повторим скоро
            state.intervalDays = Math.min(state.intervalDays, REVIEW_INTERVALS[0])
        } else {
            state.intervalDays = SpacedRepetitionService.reducedInterval(state.intervalDays)
        }

        state.nextReviewAt = new Date(now.getTime() + state.intervalDays * DAY_MS).toISOString()
        state.status =
            correct && state.intervalDays >= LEARNED_INTERVAL_DAYS ? WordLearningStatus.Learned : WordLearningStatus.Learning

        return state
    },
}
