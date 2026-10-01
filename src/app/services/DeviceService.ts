import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { Router } from 'vue-router'

/** Корневые экраны: «Назад» на них закрывает приложение, а не листает историю. */
const EXIT_ROUTES = ['Login', 'StudentHome', 'TeacherDashboard', 'Students']

// Фоны из tokens.scss ($color-background / $dark-color-background)
const STATUS_BAR_COLORS = { light: '#F6F4EF', dark: '#12161C' }

export class DeviceService {
    static get isNative() {
        return Capacitor.isNativePlatform()
    }

    /** Аппаратная кнопка / системный жест «Назад» на Android. */
    static initBackButton(router: Router) {
        if (!this.isNative) return
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            const name = router.currentRoute.value.name as string
            if (EXIT_ROUTES.includes(name) || !canGoBack) CapacitorApp.exitApp()
            else router.back()
        })
    }

    /** Колбэк при возврате приложения на передний план (проверка обновлений, синхронизация). */
    static onResume(callback: () => void) {
        if (!this.isNative) return
        CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) callback()
        })
    }

    static async updateStatusBarStyle(isDark: boolean) {
        if (!this.isNative) return
        try {
            // Style.Dark — светлый текст на тёмном фоне
            await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
            if (Capacitor.getPlatform() === 'android') {
                await StatusBar.setBackgroundColor({ color: isDark ? STATUS_BAR_COLORS.dark : STATUS_BAR_COLORS.light })
            }
        } catch (error) {
            console.warn('Failed to update status bar style:', error)
        }
    }
}
