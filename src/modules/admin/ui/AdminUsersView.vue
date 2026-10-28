<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LxBadge, LxCard, LxEmptyState, LxInput, LxPageHeader, LxSegmented, LxSpinner } from '@/design-system'
import { AdminService } from '../services/AdminService'
import type { AdminUser } from '../domain/Admin'
import { ROLE_LABELS, UserRole } from '@/modules/auth/domain/User'
import { formatDate } from '@/shared/lib/dates'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const router = useRouter()
const { notify } = useNotify()

const users = ref<AdminUser[]>([])
const isLoading = ref(true)
const query = ref('')
const role = ref<UserRole | 'all'>('all')

onMounted(async () => {
  try {
    users.value = await AdminService.users()
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить пользователей'), 'error')
  } finally {
    isLoading.value = false
  }
})

const roleOptions = [
  { value: 'all' as const, label: 'Все' },
  { value: UserRole.Student, label: 'Ученики' },
  { value: UserRole.Parent, label: 'Родители' },
  { value: UserRole.Teacher, label: 'Учителя' },
  { value: UserRole.Admin, label: 'Админы' },
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return users.value.filter(
    u =>
      (role.value === 'all' || u.roles.includes(role.value)) &&
      (!q || u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)),
  )
})

const roleTone = (r: UserRole) =>
  r === UserRole.Admin ? 'error' : r === UserRole.Teacher ? 'success' : r === UserRole.Parent ? 'warning' : 'primary'
</script>

<template>
  <div class="page">
    <LxPageHeader title="Пользователи" :subtitle="`Всего: ${users.length}`" />

    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <template v-else>
      <LxCard class="filters">
        <LxInput v-model="query" label="Поиск" placeholder="Имя или почта" />
        <LxSegmented v-model="role" :options="roleOptions" label="Роль" />
      </LxCard>

      <LxEmptyState v-if="!filtered.length" compact title="Никого не найдено" description="Измените поиск или фильтр роли." />

      <div v-else class="lx-table-wrap">
        <table class="lx-table">
          <thead>
            <tr><th>Имя</th><th>Почта</th><th>Роли</th><th>Регистрация</th><th>Последний вход</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in filtered" :key="u.id" class="clickable" @click="router.push(`/admin/users/${u.id}`)">
              <td><b>{{ u.name || '—' }}</b></td>
              <td>{{ u.email ?? '—' }}</td>
              <td class="roles">
                <LxBadge v-for="r in u.roles" :key="r" :tone="roleTone(r)">{{ ROLE_LABELS[r] }}</LxBadge>
              </td>
              <td>{{ formatDate(u.createdAt) }}</td>
              <td>{{ u.lastSignInAt ? formatDate(u.lastSignInAt) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
</style>
