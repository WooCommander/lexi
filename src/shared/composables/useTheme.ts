import { ref } from 'vue'

const STORAGE_KEY = 'lx_theme'
const isDark = ref(false)

const readStored = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

export function useTheme() {
    const applyTheme = () => {
        document.body.classList.toggle('dark-theme', isDark.value)
        try {
            localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
        } catch {
            // приватный режим — тема просто не запомнится
        }
        const meta = document.querySelector('meta[name="theme-color"]')
        meta?.setAttribute('content', isDark.value ? '#12161C' : '#0F8B77')
    }

    const toggleTheme = () => {
        isDark.value = !isDark.value
        applyTheme()
    }

    const initTheme = () => {
        const saved = readStored()
        isDark.value = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme()
    }

    return { isDark, toggleTheme, initTheme }
}
