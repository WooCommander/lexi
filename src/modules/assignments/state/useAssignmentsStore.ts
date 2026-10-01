import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AssignmentService } from '../services/AssignmentService'
import type { AssignmentInput, AssignmentStatus, LearningAssignment } from '../domain/Assignment'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'

/** Задания, созданные текущим учителем / родителем. */
export const useAssignmentsStore = defineStore('assignments', () => {
    const assignments = ref<LearningAssignment[]>([])
    const isLoading = ref(false)
    const loadedFor = ref<string | null>(null)

    const load = async (force = false) => {
        const auth = useAuthStore()
        if (!auth.userId) return
        if (!force && loadedFor.value === auth.userId) return
        isLoading.value = true
        try {
            assignments.value = await AssignmentService.fetchCreatedBy(auth.userId)
            loadedFor.value = auth.userId
        } finally {
            isLoading.value = false
        }
    }

    const create = async (input: AssignmentInput) => {
        const created = await AssignmentService.create(input)
        assignments.value = [created, ...assignments.value]
        return created
    }

    const setStatus = async (id: string, status: AssignmentStatus) => {
        await AssignmentService.setStatus(id, status)
        assignments.value = assignments.value.map(a => (a.id === id ? { ...a, status } : a))
    }

    const remove = async (id: string) => {
        await AssignmentService.remove(id)
        assignments.value = assignments.value.filter(a => a.id !== id)
    }

    return { assignments, isLoading, load, create, setStatus, remove }
})
