export enum UserRole {
    Student = 'student',
    Parent = 'parent',
    Teacher = 'teacher',
}

export interface Profile {
    id: string
    name: string
    createdAt: string
}

export interface UserRoleModel {
    userId: string
    role: UserRole
}

export const ROLE_LABELS: Record<UserRole, string> = {
    [UserRole.Student]: 'Ученик',
    [UserRole.Parent]: 'Родитель',
    [UserRole.Teacher]: 'Учитель',
}

export const ALL_ROLES: UserRole[] = [UserRole.Student, UserRole.Parent, UserRole.Teacher]

export const isUserRole = (value: unknown): value is UserRole =>
    typeof value === 'string' && (ALL_ROLES as string[]).includes(value)

export interface ProfileRow {
    id: string
    name: string
    created_at: string
}

export const profileFromRow = (row: ProfileRow): Profile => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
})
