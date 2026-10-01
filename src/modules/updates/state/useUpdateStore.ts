import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { UpdateService, type UpdateInfo } from '../services/UpdateService'

const DISMISS_KEY = 'lx_update_dismissed_version'

const readDismissed = () => {
    try {
        return localStorage.getItem(DISMISS_KEY) || ''
    } catch {
        return ''
    }
}

export const useUpdateStore = defineStore('updates', () => {
    const available = ref<UpdateInfo | null>(null)
    const dismissedVersion = ref(readDismissed())
    const isChecking = ref(false)
    const lastCheckedAt = ref<number | null>(null)

    const currentVersion = UpdateService.currentVersion
    const isSupported = UpdateService.isSupported

    /** Баннер показываем, пока пользователь не свернул именно эту версию. */
    const bannerVisible = computed(() => !!available.value && available.value.version !== dismissedVersion.value)

    const check = async () => {
        if (!isSupported || isChecking.value) return
        isChecking.value = true
        try {
            available.value = await UpdateService.check()
            lastCheckedAt.value = Date.now()
        } finally {
            isChecking.value = false
        }
    }

    /** Повторная проверка при возврате в приложение — не чаще раза в 30 минут. */
    const checkIfStale = () => {
        if (!lastCheckedAt.value || Date.now() - lastCheckedAt.value > 30 * 60 * 1000) void check()
    }

    const dismiss = () => {
        const v = available.value?.version
        if (!v) return
        dismissedVersion.value = v
        try {
            localStorage.setItem(DISMISS_KEY, v)
        } catch {
            /* ignore */
        }
    }

    const install = () => {
        if (available.value) UpdateService.install(available.value.apkUrl)
    }

    return { available, isChecking, currentVersion, isSupported, bannerVisible, check, checkIfStale, dismiss, install }
})
