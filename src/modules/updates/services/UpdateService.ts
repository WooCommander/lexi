import { Capacitor } from '@capacitor/core'
import { compareVersions } from '../lib/semver'

export interface UpdateInfo {
    version: string
    apkUrl: string
    notes?: string
}

interface VersionManifest {
    version: string
    versionCode?: number
    apkUrl: string
    notes?: string
}

/**
 * Проверка обновлений для APK, установленного не из Google Play.
 * scripts/upload-release.js кладёт version.json в публичный bucket "releases".
 */
export class UpdateService {
    static readonly currentVersion = __APP_VERSION__

    /** Обновления через APK имеют смысл только в нативном Android-приложении. */
    static get isSupported() {
        return Capacitor.getPlatform() === 'android'
    }

    static manifestUrl() {
        const base = import.meta.env.VITE_SUPABASE_URL
        // t= обходит кеш CDN Storage
        return `${base}/storage/v1/object/public/releases/version.json?t=${Date.now()}`
    }

    static async check(): Promise<UpdateInfo | null> {
        if (!UpdateService.isSupported) return null
        try {
            const res = await fetch(UpdateService.manifestUrl(), { cache: 'no-store' })
            if (!res.ok) return null
            const data = (await res.json()) as VersionManifest
            if (!data.version || !data.apkUrl) return null
            return compareVersions(data.version, UpdateService.currentVersion) > 0
                ? { version: data.version, apkUrl: data.apkUrl, notes: data.notes }
                : null
        } catch {
            return null
        }
    }

    /** '_system' открывает ссылку в системном браузере: Android скачает APK и предложит установить. */
    static install(apkUrl: string) {
        window.open(apkUrl, '_system')
    }
}
