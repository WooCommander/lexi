<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Trash2 } from 'lucide-vue-next'
import {
  LxBadge,
  LxButton,
  LxCard,
  LxCheckbox,
  LxConfirmationModal,
  LxPageHeader,
  LxSpinner,
  LxStatTile,
} from '@/design-system'
import StudentStatsPanel from '@/modules/statistics/ui/components/StudentStatsPanel.vue'
import { AdminService } from '../services/AdminService'
import type { AdminUser, TeacherStat } from '../domain/Admin'
import { percentText, teacherAccuracy } from '../lib/dashboard'
import { ALL_ROLES, ROLE_LABELS, UserRole } from '@/modules/auth/domain/User'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { StatisticsService, type StudentsStatsData } from '@/modules/statistics/services/StatisticsService'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { formatDate } from '@/shared/lib/dates'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const languages = useLanguagesStore()
const { notify } = useNotify()

const userId = computed(() => String(route.params.id))
const isMe = computed(() => userId.value === auth.userId)

const user = ref<AdminUser | null>(null)
const stats = ref<StudentsStatsData | null>(null)
const teacher = ref<TeacherStat | null>(null)
const isLoading = ref(true)
const isDeleteOpen = ref(false)
const busyRole = ref<UserRole | null>(null)

onMounted(async () => {
  try {
    await languages.load()
    const [all, teachers, data] = await Promise.all([
      AdminService.users(),
      AdminService.teachers(),
      StatisticsService.loadForStudents([userId.value]),
    ])
    user.value = all.find(u => u.id === userId.value) ?? null
    teacher.value = teachers.find(t => t.teacherId === userId.value) ?? null
    stats.value = data
    if (!user.value) router.replace('/admin/users')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить пользователя'), 'error')
  } finally {
    isLoading.value = false
  }
})

const toggleRole = async (role: UserRole, on: boolean) => {
  const current = user.value
  if (!current) return
  busyRole.value = role
  try {
    if (on) await AdminService.addRole(current.id, role)
    else await AdminService.removeRole(current.id, role)
    user.value = { ...current, roles: on ? [...current.roles, role] : current.roles.filter(r => r !== role) }
  } catch (e) {
    // например, «last_admin»: последнего администратора снять нельзя
    notify(errorMessage(e, 'Не удалось изменить роль'), 'error')
  } finally {
    busyRole.value = null
  }
}

const remove = async () => {
  if (!user.value) return
  try {
    await AdminService.deleteUser(user.value.id)
    notify('Пользователь удалён вместе с данными', 'success')
    router.replace('/admin/users')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось удалить пользователя'), 'error')
  }
}

const hasProgress = computed(() => !!stats.value?.progress.length)
</script>

<template>
  <div class="page">
    <LxPageHeader back="/admin/users" :title="user?.name || 'Пользователь'" :subtitle="user?.email ?? ''">
      <template #actions>
        <LxButton variant="danger" :disabled="isMe" :title="isMe ? 'Себя удалить нельзя' : undefined"
          @click="isDeleteOpen = true">
          <Trash2 :size="20" /> Удалить
        </LxButton>
      </template>
    </LxPageHeader>

    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <template v-else-if="user">
      <LxCard class="stack">
        <h2 class="section-title">Роли</h2>
        <LxCheckbox v-for="r in ALL_ROLES" :key="r" :model-value="user.roles.includes(r)" :disabled="busyRole === r"
          @update:model-value="v => toggleRole(r, v)">
          {{ ROLE_LABELS[r] }}
          <LxBadge v-if="r === UserRole.Admin" tone="error">полный доступ</LxBadge>
        </LxCheckbox>
        <p class="caption">
          Зарегистрирован {{ formatDate(user.createdAt) }} · последний вход {{ user.lastSignInAt ? formatDate(user.lastSignInAt) : '—' }}.
          Последнего администратора снять нельзя.
        </p>
      </LxCard>

      <section v-if="teacher" class="grid-stats">
        <LxStatTile label="Учеников" :value="teacher.students" />
        <LxStatTile label="Групп" :value="teacher.groups" />
        <LxStatTile label="Наборов" :value="teacher.sets" />
        <LxStatTile label="Освоено учениками" :value="teacher.learned" tone="success" />
        <LxStatTile label="Точность учеников" :value="percentText(teacherAccuracy(teacher))" tone="primary" />
      </section>

      <section v-if="hasProgress && stats" class="section">
        <h2 class="section-title">Как учится</h2>
        <StudentStatsPanel :data="stats" :student-id="user.id" :native-language-id="null" />
      </section>
      <p v-else-if="!teacher" class="muted">У этого пользователя пока нет прогресса в обучении.</p>
    </template>

    <LxConfirmationModal v-model:visible="isDeleteOpen" :title="`Удалить ${user?.name || 'пользователя'}?`"
      message="Аккаунт, наборы, слова, прогресс и история будут удалены без возможности восстановления."
      confirm-text="Удалить" variant="danger" @confirm="remove" />
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}
</style>
