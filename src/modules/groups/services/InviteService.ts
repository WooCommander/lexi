import { supabase } from '@/api/supabase'
import type { InviteCode, InviteKind, InvitePreview } from '../domain/Group'
import { generateInviteCode, normalizeInviteCode } from '../lib/inviteCode'

const UNIQUE_VIOLATION = '23505'

export const INVITE_ERRORS: Record<string, string> = {
    invalid_code: 'Код не найден. Проверьте, нет ли опечатки.',
    own_code: 'Это ваш собственный код.',
    not_authenticated: 'Нужно войти в аккаунт.',
}

export class InviteService {
    /** Код генерируется на клиенте; при коллизии пробуем ещё раз. */
    static async create(kind: InviteKind, prefix: string, groupId?: string): Promise<string> {
        for (let attempt = 0; attempt < 5; attempt++) {
            const code = generateInviteCode(prefix)
            const { error } = await supabase.from('invite_codes').insert({ code, kind, group_id: groupId ?? null })
            if (!error) return code
            if (error.code !== UNIQUE_VIOLATION) throw error
        }
        throw new Error('Не удалось создать уникальный код, попробуйте ещё раз')
    }

    /** Личные коды (без группы) текущего пользователя. */
    static async fetchPersonal(ownerId: string, kind: InviteKind): Promise<InviteCode | null> {
        const { data, error } = await supabase
            .from('invite_codes')
            .select('code, kind, group_id')
            .eq('owner_id', ownerId)
            .eq('kind', kind)
            .is('group_id', null)
            .order('created_at', { ascending: false })
            .limit(1)
        if (error) throw error
        const row = data?.[0]
        return row ? { code: row.code, kind: row.kind, groupId: row.group_id ?? undefined } : null
    }

    static async remove(code: string): Promise<void> {
        const { error } = await supabase.from('invite_codes').delete().eq('code', code)
        if (error) throw error
    }

    static async preview(code: string): Promise<InvitePreview | null> {
        const { data, error } = await supabase.rpc('preview_invite_code', { p_code: normalizeInviteCode(code) })
        if (error) throw error
        const row = (data as { kind: InviteKind; owner_name: string; group_name: string | null }[] | null)?.[0]
        return row ? { kind: row.kind, ownerName: row.owner_name, groupName: row.group_name ?? undefined } : null
    }

    static async redeem(code: string): Promise<void> {
        const { error } = await supabase.rpc('redeem_invite_code', { p_code: normalizeInviteCode(code) })
        if (error) {
            const known = Object.keys(INVITE_ERRORS).find(key => error.message.includes(key))
            throw new Error(known ? INVITE_ERRORS[known] : error.message)
        }
    }
}
