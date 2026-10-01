import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GroupService } from '../services/GroupService'
import { InviteService } from '../services/InviteService'
import type { StudentGroup } from '../domain/Group'
import { invitePrefix } from '../lib/inviteCode'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'

export const useGroupsStore = defineStore('groups', () => {
    const groups = ref<StudentGroup[]>([])
    const isLoading = ref(false)
    const loadedFor = ref<string | null>(null)

    const load = async (force = false) => {
        const auth = useAuthStore()
        if (!auth.userId) return
        if (!force && loadedFor.value === auth.userId) return
        isLoading.value = true
        try {
            groups.value = await GroupService.fetchByTeacher(auth.userId)
            loadedFor.value = auth.userId
        } finally {
            isLoading.value = false
        }
    }

    const get = (id: string) => groups.value.find(g => g.id === id)

    const create = async (name: string, languageId?: string) => {
        const code = languageId ? useLanguagesStore().get(languageId)?.code : undefined
        const group = await GroupService.create(name, languageId, invitePrefix(code))
        groups.value = [group, ...groups.value]
        return group
    }

    const regenerateCode = async (groupId: string) => {
        const group = get(groupId)
        if (!group) return
        if (group.inviteCode) await InviteService.remove(group.inviteCode)
        const code = group.languageId ? useLanguagesStore().get(group.languageId)?.code : undefined
        const inviteCode = await InviteService.create('teacher', invitePrefix(code), groupId)
        groups.value = groups.value.map(g => (g.id === groupId ? { ...g, inviteCode } : g))
    }

    const rename = async (id: string, name: string) => {
        await GroupService.rename(id, name)
        groups.value = groups.value.map(g => (g.id === id ? { ...g, name: name.trim() } : g))
    }

    const remove = async (id: string) => {
        await GroupService.remove(id)
        groups.value = groups.value.filter(g => g.id !== id)
    }

    const addStudent = async (groupId: string, studentId: string) => {
        await GroupService.addStudent(groupId, studentId)
        groups.value = groups.value.map(g =>
            g.id === groupId && !g.studentIds.includes(studentId) ? { ...g, studentIds: [...g.studentIds, studentId] } : g,
        )
    }

    const removeStudent = async (groupId: string, studentId: string) => {
        await GroupService.removeStudent(groupId, studentId)
        groups.value = groups.value.map(g =>
            g.id === groupId ? { ...g, studentIds: g.studentIds.filter(id => id !== studentId) } : g,
        )
    }

    return { groups, isLoading, load, get, create, regenerateCode, rename, remove, addStudent, removeStudent }
})
