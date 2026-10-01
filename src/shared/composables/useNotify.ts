import { ref } from 'vue'
import { LxHaptics } from '@/shared/lib/haptics'

export type NotifyType = 'success' | 'info' | 'error' | 'warning'

export interface LxNotif {
    id: string
    type: NotifyType
    message: string
}

const notifications = ref<LxNotif[]>([])
let _id = 0

export function useNotify() {
    const notify = (message: string, type: NotifyType = 'info', duration = 3000) => {
        const id = String(++_id)
        notifications.value.push({ id, type, message })

        if (type === 'success') LxHaptics.success()
        else if (type === 'error') LxHaptics.error()
        else if (type === 'warning') LxHaptics.warning()
        else LxHaptics.light()

        if (duration > 0) {
            setTimeout(() => dismiss(id), duration)
        }
    }

    const dismiss = (id: string) => {
        const idx = notifications.value.findIndex(n => n.id === id)
        if (idx !== -1) notifications.value.splice(idx, 1)
    }

    return { notifications, notify, dismiss }
}
