import { supabase } from '@/api/supabase'
import type { Session, User } from '@supabase/supabase-js'
import { isUserRole, profileFromRow, type Profile, type ProfileRow, type UserRole } from '../domain/User'

export type { Session, User }

export class AuthService {
    static async getSession(): Promise<Session | null> {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        return data.session
    }

    static async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        return data
    }

    /** Профиль и роли создаёт триггер handle_new_user из options.data. */
    static async signUp(email: string, password: string, name: string, roles: UserRole[]) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, roles },
                emailRedirectTo: `${window.location.origin}/login`,
            },
        })
        if (error) throw error
        return data
    }

    static async signOut(): Promise<void> {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    static async sendResetLink(email: string): Promise<void> {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        })
        if (error) throw error
    }

    static async updatePassword(password: string): Promise<void> {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
    }

    static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        return supabase.auth.onAuthStateChange(callback)
    }

    static async fetchProfile(userId: string): Promise<Profile | null> {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
        if (error) throw error
        return data ? profileFromRow(data as ProfileRow) : null
    }

    static async fetchRoles(userId: string): Promise<UserRole[]> {
        const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId)
        if (error) throw error
        return (data ?? []).map(r => r.role).filter(isUserRole)
    }

    static async updateName(userId: string, name: string): Promise<void> {
        const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', userId)
        if (error) throw error
    }

    static async addRole(userId: string, role: UserRole): Promise<void> {
        const { error } = await supabase
            .from('user_roles')
            .upsert({ user_id: userId, role }, { onConflict: 'user_id,role', ignoreDuplicates: true })
        if (error) throw error
    }

    static async removeRole(userId: string, role: UserRole): Promise<void> {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
        if (error) throw error
    }
}
