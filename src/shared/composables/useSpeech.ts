import { ref, watch } from 'vue'
import { Speech } from '@/shared/lib/speech'

const STORAGE_KEY = 'lx_auto_speak'

const readStored = (): boolean => {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
        return false
    }
}

/** Автоозвучка — личная настройка устройства, хранится локально. */
const autoSpeak = ref(readStored())

watch(autoSpeak, value => {
    try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
        // приватный режим — настройка просто не запомнится
    }
    if (!value) Speech.stop()
})

export function useSpeech() {
    return { autoSpeak, isSupported: Speech.isSupported(), speak: Speech.speak, stop: Speech.stop }
}
