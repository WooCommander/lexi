import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LinkService, type LinkKind } from '../services/LinkService'
import type { Profile } from '@/modules/auth/domain/User'
import { UserRole } from '@/modules/auth/domain/User'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'

/**
 * Связанные ученики для текущей роли: учитель видит своих учеников, родитель — детей.
 */
export const useStudentsStore = defineStore('students', () => {
    const students = ref<Profile[]>([])
    const isLoading = ref(false)
    const loadedKey = ref<string | null>(null)

    const kind = computed<LinkKind>(() => (useAuthStore().activeRole === UserRole.Parent ? 'parent' : 'teacher'))
    const byId = computed(() => new Map(students.value.map(s => [s.id, s])))
    const nameOf = (id: string) => byId.value.get(id)?.name || 'Ученик'

    const load = async (force = false) => {
        const auth = useAuthStore()
        if (!auth.userId) return
        const key = `${auth.userId}:${kind.value}`
        if (!force && loadedKey.value === key) return
        isLoading.value = true
        try {
            students.value = await LinkService.fetchStudents(kind.value, auth.userId)
            loadedKey.value = key
        } finally {
            isLoading.value = false
        }
    }

    const unlink = async (studentId: string) => {
        const auth = useAuthStore()
        if (!auth.userId) return
        await LinkService.unlink(kind.value, auth.userId, studentId)
        students.value = students.value.filter(s => s.id !== studentId)
    }

    return { students, isLoading, kind, byId, nameOf, load, unlink }
})
