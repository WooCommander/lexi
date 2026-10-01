import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AuthService, type Session, type User } from '../services/AuthService'
import { ALL_ROLES, UserRole, isUserRole, type Profile } from '../domain/User'
import { errorMessage } from '@/shared/lib/errors'

const ACTIVE_ROLE_KEY = 'lx_active_role'

const readActiveRole = (): UserRole | null => {
    try {
        const value = localStorage.getItem(ACTIVE_ROLE_KEY)
        return isUserRole(value) ? value : null
    } catch {
        return null
    }
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const session = ref<Session | null>(null)
    const profile = ref<Profile | null>(null)
    const roles = ref<UserRole[]>([])
    const activeRole = ref<UserRole | null>(readActiveRole())
    const isLoading = ref(true)
    const isRecoveryFlow = ref(false)
    const error = ref<string | null>(null)

    const isAuthenticated = computed(() => !!user.value)
    const userId = computed(() => user.value?.id ?? null)
    const displayName = computed(() => profile.value?.name || user.value?.email?.split('@')[0] || '')
    const hasRole = (role: UserRole) => roles.value.includes(role)

    // Улучшение относительно init().then(mount): роутер ждёт этот промис в guard,
    // поэтому прямой заход по ссылке не уводит на /login до восстановления сессии.
    let readyPromise: Promise<void> | null = null

    const setActiveRole = (role: UserRole) => {
        if (!hasRole(role)) return
        activeRole.value = role
        try {
            localStorage.setItem(ACTIVE_ROLE_KEY, role)
        } catch {
            // не критично
        }
    }

    const ensureActiveRole = () => {
        if (activeRole.value && hasRole(activeRole.value)) return
        const fallback = ALL_ROLES.find(r => hasRole(r))
        if (fallback) setActiveRole(fallback)
        else activeRole.value = null
    }

    const loadAccount = async () => {
        if (!user.value) {
            profile.value = null
            roles.value = []
            return
        }
        const id = user.value.id
        const [p, r] = await Promise.all([AuthService.fetchProfile(id), AuthService.fetchRoles(id)])
        profile.value = p
        roles.value = r.length ? r : [UserRole.Student]
        ensureActiveRole()
    }

    const applySession = async (next: Session | null) => {
        const changedUser = next?.user?.id !== user.value?.id
        session.value = next
        user.value = next?.user ?? null
        if (changedUser) await loadAccount().catch(e => console.error('Account load failed:', e))
    }

    const init = () => {
        if (readyPromise) return readyPromise
        readyPromise = (async () => {
            isLoading.value = true
            try {
                await applySession(await AuthService.getSession())
            } catch (e) {
                console.error('Auth init error:', e)
            } finally {
                isLoading.value = false
            }

            AuthService.onAuthStateChange((event, next) => {
                if (event === 'PASSWORD_RECOVERY') isRecoveryFlow.value = true
                if (event === 'SIGNED_OUT') isRecoveryFlow.value = false
                // колбэк Supabase нельзя делать async-блокирующим — грузим аккаунт в фоне
                setTimeout(() => applySession(next), 0)
            })
        })()
        return readyPromise
    }

    const login = async (email: string, password: string) => {
        error.value = null
        try {
            const data = await AuthService.signIn(email, password)
            await applySession(data.session)
            return true
        } catch (e) {
            error.value = errorMessage(e)
            return false
        }
    }

    const register = async (email: string, password: string, name: string, selectedRoles: UserRole[]) => {
        error.value = null
        try {
            const data = await AuthService.signUp(email, password, name, selectedRoles)
            if (data.session) {
                await applySession(data.session)
                return { success: true, needsConfirmation: false }
            }
            return { success: true, needsConfirmation: true }
        } catch (e) {
            error.value = errorMessage(e)
            return { success: false, needsConfirmation: false }
        }
    }

    const logout = async () => {
        user.value = null
        session.value = null
        profile.value = null
        roles.value = []
        isRecoveryFlow.value = false
        await AuthService.signOut().catch(console.error)
    }

    const sendResetLink = async (email: string) => {
        error.value = null
        try {
            await AuthService.sendResetLink(email)
            return true
        } catch (e) {
            error.value = errorMessage(e)
            return false
        }
    }

    const updatePassword = async (password: string) => {
        error.value = null
        try {
            await AuthService.updatePassword(password)
            isRecoveryFlow.value = false
            return true
        } catch (e) {
            error.value = errorMessage(e)
            return false
        }
    }

    const updateName = async (name: string) => {
        if (!userId.value) return
        await AuthService.updateName(userId.value, name)
        if (profile.value) profile.value = { ...profile.value, name: name.trim() }
    }

    const addRole = async (role: UserRole) => {
        if (!userId.value || hasRole(role)) return
        await AuthService.addRole(userId.value, role)
        roles.value = [...roles.value, role]
    }

    const removeRole = async (role: UserRole) => {
        if (!userId.value || roles.value.length <= 1) return
        await AuthService.removeRole(userId.value, role)
        roles.value = roles.value.filter(r => r !== role)
        ensureActiveRole()
    }

    return {
        user,
        session,
        profile,
        roles,
        activeRole,
        isLoading,
        isRecoveryFlow,
        error,
        isAuthenticated,
        userId,
        displayName,
        hasRole,
        init,
        refreshAccount: loadAccount,
        setActiveRole,
        login,
        register,
        logout,
        sendResetLink,
        updatePassword,
        updateName,
        addRole,
        removeRole,
    }
})
