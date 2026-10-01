import { supabase } from '@/api/supabase'
import { GROUP_SELECT, groupFromRow, type GroupRow, type StudentGroup } from '../domain/Group'
import { InviteService } from './InviteService'

export class GroupService {
    static async fetchByTeacher(teacherId: string): Promise<StudentGroup[]> {
        const { data, error } = await supabase
            .from('groups')
            .select(GROUP_SELECT)
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return (data as GroupRow[]).map(groupFromRow)
    }

    /** Группа сразу получает код приглашения. */
    static async create(name: string, languageId: string | undefined, codePrefix: string): Promise<StudentGroup> {
        const { data, error } = await supabase
            .from('groups')
            .insert({ name: name.trim(), language_id: languageId ?? null })
            .select('*')
            .single()
        if (error) throw error
        const group = groupFromRow(data as GroupRow)
        const inviteCode = await InviteService.create('teacher', codePrefix, group.id)
        return { ...group, inviteCode }
    }

    static async rename(id: string, name: string): Promise<void> {
        const { error } = await supabase.from('groups').update({ name: name.trim() }).eq('id', id)
        if (error) throw error
    }

    static async remove(id: string): Promise<void> {
        const { error } = await supabase.from('groups').delete().eq('id', id)
        if (error) throw error
    }

    static async addStudent(groupId: string, studentId: string): Promise<void> {
        const { error } = await supabase
            .from('group_students')
            .upsert({ group_id: groupId, student_id: studentId }, { ignoreDuplicates: true })
        if (error) throw error
    }

    static async removeStudent(groupId: string, studentId: string): Promise<void> {
        const { error } = await supabase
            .from('group_students')
            .delete()
            .eq('group_id', groupId)
            .eq('student_id', studentId)
        if (error) throw error
    }
}
