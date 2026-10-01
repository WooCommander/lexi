import type { AnswerRecord } from './ProgressService'

/**
 * Очередь ответов, которые не удалось отправить (нет сети).
 * Тот же приём, что OfflinePriceQueue в fair price: localStorage + повторная отправка.
 * Порядок сохраняется: для одного слова последний прогресс в очереди — самый свежий.
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

export const OfflineAnswerQueue = {
    all: read,

    push(record: AnswerRecord) {
        write([...read(), record])
    },

    count: () => read().length,

    /** Отправляет по одному; останавливается на первой ошибке, чтобы не нарушить порядок. */
    async flush(send: (record: AnswerRecord) => Promise<void>): Promise<number> {
        const queue = read()
        let sent = 0
        for (const record of queue) {
            try {
                await send(record)
                sent++
            } catch {
                break
            }
        }
        write(queue.slice(sent))
        return sent
    },
}
