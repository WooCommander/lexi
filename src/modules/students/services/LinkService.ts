import { supabase } from '@/api/supabase'
import { profileFromRow, type Profile, type ProfileRow } from '@/modules/auth/domain/User'

export type LinkKind = 'teacher' | 'parent'

const TABLE: Record<LinkKind, { table: string; ownerColumn: string }> = {
    teacher: { table: 'teacher_students', ownerColumn: 'teacher_id' },
    parent: { table: 'parent_students', ownerColumn: 'parent_id' },
}

/** Связи учитель ↔ ученик и родитель ↔ ребёнок. Создаются только через код приглашения. */
export class LinkService {
    /** Ученики учителя или дети родителя. */
    static async fetchStudents(kind: LinkKind, ownerId: string): Promise<Profile[]> {
        const { table, ownerColumn } = TABLE[kind]
        const { data, error } = await supabase
            .from(table)
            .select('created_at, student:profiles!student_id(*)')
            .eq(ownerColumn, ownerId)
            .order('created_at')
        if (error) throw error
        return (data as unknown as { student: ProfileRow | null }[])
            .map(r => r.student)
            .filter((r): r is ProfileRow => !!r)
            .map(profileFromRow)
    }

    /** Учителя или родители ученика. */
    static async fetchMentors(kind: LinkKind, studentId: string): Promise<Profile[]> {
        const { table, ownerColumn } = TABLE[kind]
        const { data, error } = await supabase
            .from(table)
            .select(`mentor:profiles!${ownerColumn}(*)`)
            .eq('student_id', studentId)
        if (error) throw error
        return (data as unknown as { mentor: ProfileRow | null }[])
            .map(r => r.mentor)
            .filter((r): r is ProfileRow => !!r)
            .map(profileFromRow)
    }

    static async unlink(kind: LinkKind, ownerId: string, studentId: string): Promise<void> {
        const { table, ownerColumn } = TABLE[kind]
        const { error } = await supabase.from(table).delete().eq(ownerColumn, ownerId).eq('student_id', studentId)
        if (error) throw error
    }
}
