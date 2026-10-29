import type { AnswerRecord } from './ProgressService'

/**
 * Очередь ответов, которые не удалось отправить (нет сети).
 * Тот же приём, что OfflinePriceQueue в fair price: localStorage + повторная отправка.
 * Порядок сохраняется: для одного слова последний прогресс в очереди — самый свежий.
 *
 * Очередь общая на устройство, а записи принадлежат пользователям (`progress.studentId`):
 * вошедший видит и отправляет только свои, чужие ждут своего владельца.
 */
const STORAGE_KEY = 'lx_pending_answers'

const read = (): AnswerRecord[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as AnswerRecord[]) : []
    } catch {
        return []
    }
}

const write = (records: AnswerRecord[]) => {
    try {
        if (records.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
        else localStorage.removeItem(STORAGE_KEY)
    } catch {
        // хранилище недоступно — ответы будут потеряны при закрытии вкладки
    }
}

const ownedBy = (userId: string | null | undefined) => (r: AnswerRecord) => !userId || r.progress.studentId === userId

const keyOf = (r: AnswerRecord) => `${r.progress.studentId}|${r.progress.vocabularyItemId}|${r.answeredAt}`

/**
 * Ошибка, после которой повтор бессмысленен: нарушение целостности (слово удалено), запрет RLS (доступ отозван),
 * ошибка клиента 4xx. Такую запись отбрасываем, иначе она заблокировала бы все ответы за ней навсегда.
 * Сетевые сбои и 5xx — временные: очередь ждёт.
 */
export const isPermanentError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const { code, status } = error as { code?: unknown; status?: unknown }
    if (typeof code === 'string' && (code.startsWith('23') || code === '42501' || code.startsWith('PGRST3'))) return true
    return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429
}

/** Одновременные flush (загрузка экрана + возврат в сеть) отправили бы одни и те же ответы дважды. */
let inFlight: Promise<number> | null = null

const flushOnce = async (send: (record: AnswerRecord) => Promise<void>, userId?: string | null): Promise<number> => {
    const queue = read().filter(ownedBy(userId))
    const done = new Set<string>()
    let sent = 0
    for (const record of queue) {
        try {
            await send(record)
            sent++
            done.add(keyOf(record))
        } catch (e) {
            if (isPermanentError(e)) {
                done.add(keyOf(record)) // не пройдёт никогда — убираем, чтобы не держать очередь
                continue
            }
            break
        }
    }
    // очередь перечитываем: пока шла отправка, push мог дописать новые ответы в конец
    write(read().filter(r => !done.has(keyOf(r))))
    return sent
}

export const OfflineAnswerQueue = {
    /** Все записи устройства или только пользователя `userId`. */
    all: (userId?: string | null) => read().filter(ownedBy(userId)),

    push(record: AnswerRecord) {
        write([...read(), record])
    },

    count: (userId?: string | null) => read().filter(ownedBy(userId)).length,

    /** Отправляет по одному; на временной ошибке останавливается, чтобы не нарушить порядок. */
    flush(send: (record: AnswerRecord) => Promise<void>, userId?: string | null): Promise<number> {
        inFlight ??= flushOnce(send, userId).finally(() => {
            inFlight = null
        })
        return inFlight
    },
}
