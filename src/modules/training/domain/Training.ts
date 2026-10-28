import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'

/**
 * Forward: sourceLanguage → targetLanguage
 * Reverse: targetLanguage → sourceLanguage
 */
export enum TrainingDirection {
    Forward = 'forward',
    Reverse = 'reverse',
}

/** «Знаю / Сомневаюсь / Не знаю». «Сомневаюсь» не продвигает интервал и возвращает слово в тренировку. */
export enum TrainingResult {
    Correct = 'correct',
    Wrong = 'wrong',
    Unsure = 'unsure',
}

export enum WordLearningStatus {
    New = 'new',
    Learning = 'learning',
    Learned = 'learned',
}

export const STATUS_LABELS: Record<WordLearningStatus, string> = {
    [WordLearningStatus.New]: 'Новое',
    [WordLearningStatus.Learning]: 'Изучается',
    [WordLearningStatus.Learned]: 'Изучено',
}

/** mixed — направление выбирается автоматически (основной режим). */
export type TrainingMode = 'mixed' | TrainingDirection

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
    mixed: 'Смешанный',
    [TrainingDirection.Forward]: 'Прямой',
    [TrainingDirection.Reverse]: 'Обратный',
}

/** Вид упражнения: карточки (вспомнить и проверить), выбор перевода, ввод слова. */
export type ExerciseType = 'cards' | 'choice' | 'typing'

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
    cards: 'Карточки',
    choice: 'Выбор',
    typing: 'Письмо',
}

export const EXERCISE_HINTS: Record<ExerciseType, string> = {
    cards: 'Вспомните перевод и отметьте, знаете ли вы слово',
    choice: 'Выберите правильный перевод из вариантов',
    typing: 'Напишите перевод сами',
}

export const SESSION_SIZES = [5, 10, 20, 30] as const

/** Изменяемая часть прогресса — то, с чем работает SpacedRepetitionService. */
export interface SrsState {
    status: WordLearningStatus

    correctAnswers: number
    wrongAnswers: number

    forwardCorrect: number
    forwardWrong: number

    reverseCorrect: number
    reverseWrong: number

    lastReviewedAt?: string
    nextReviewAt?: string

    intervalDays: number
}

export interface WordProgress extends SrsState {
    id?: string
    studentId: string
    vocabularyItemId: string
}

export interface ReviewHistoryItem {
    id: string

    studentId: string
    vocabularyItemId: string

    direction: TrainingDirection
    result: TrainingResult

    assignmentId?: string

    createdAt: string
}

/** Слово, доступное ученику для тренировки, с источниками. */
export interface StudyItem {
    item: VocabularyItem
    setIds: string[]
    assignmentId?: string
    /** Дозированное изучение: слово ещё не «открыто» по графику задания. */
    locked: boolean
}

export interface TrainingCard {
    key: string
    item: VocabularyItem
    direction: TrainingDirection
    assignmentId?: string
    /** true — слово не было «к повторению», интервал не продвигаем. */
    isPractice: boolean
}

export interface WordProgressRow {
    id: string
    student_id: string
    vocabulary_item_id: string
    status: WordLearningStatus
    correct_answers: number
    wrong_answers: number
    forward_correct: number
    forward_wrong: number
    reverse_correct: number
    reverse_wrong: number
    last_reviewed_at: string | null
    next_review_at: string | null
    interval_days: number
}

export const wordProgressFromRow = (row: WordProgressRow): WordProgress => ({
    id: row.id,
    studentId: row.student_id,
    vocabularyItemId: row.vocabulary_item_id,
    status: row.status,
    correctAnswers: row.correct_answers,
    wrongAnswers: row.wrong_answers,
    forwardCorrect: row.forward_correct,
    forwardWrong: row.forward_wrong,
    reverseCorrect: row.reverse_correct,
    reverseWrong: row.reverse_wrong,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
    nextReviewAt: row.next_review_at ?? undefined,
    intervalDays: row.interval_days,
})

export const wordProgressToRow = (p: WordProgress) => ({
    student_id: p.studentId,
    vocabulary_item_id: p.vocabularyItemId,
    status: p.status,
    correct_answers: p.correctAnswers,
    wrong_answers: p.wrongAnswers,
    forward_correct: p.forwardCorrect,
    forward_wrong: p.forwardWrong,
    reverse_correct: p.reverseCorrect,
    reverse_wrong: p.reverseWrong,
    last_reviewed_at: p.lastReviewedAt ?? null,
    next_review_at: p.nextReviewAt ?? null,
    interval_days: p.intervalDays,
})

export interface ReviewHistoryRow {
    id: string
    student_id: string
    vocabulary_item_id: string
    direction: TrainingDirection
    result: TrainingResult
    assignment_id: string | null
    created_at: string
}

export const reviewFromRow = (row: ReviewHistoryRow): ReviewHistoryItem => ({
    id: row.id,
    studentId: row.student_id,
    vocabularyItemId: row.vocabulary_item_id,
    direction: row.direction,
    result: row.result,
    assignmentId: row.assignment_id ?? undefined,
    createdAt: row.created_at,
})
