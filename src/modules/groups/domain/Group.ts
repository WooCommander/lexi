export interface StudentGroup {
    id: string
    teacherId: string
    name: string
    languageId?: string
    studentIds: string[]
    inviteCode?: string
    createdAt: string
}

export interface GroupRow {
    id: string
    teacher_id: string
    name: string
    language_id: string | null
    created_at: string
    group_students?: { student_id: string }[]
    invite_codes?: { code: string }[]
}

export const GROUP_SELECT = '*, group_students(student_id), invite_codes(code)'

export const groupFromRow = (row: GroupRow): StudentGroup => ({
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    languageId: row.language_id ?? undefined,
    studentIds: (row.group_students ?? []).map(s => s.student_id),
    inviteCode: row.invite_codes?.[0]?.code,
    createdAt: row.created_at,
})

export type InviteKind = 'teacher' | 'parent'

export interface InviteCode {
    code: string
    kind: InviteKind
    groupId?: string
}

export interface InvitePreview {
    kind: InviteKind
    ownerName: string
    groupName?: string
}
