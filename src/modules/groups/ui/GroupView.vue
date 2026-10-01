<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BarChart3, ClipboardList, Pencil, Trash2, UserMinus, UserPlus } from 'lucide-vue-next'
import {
  LxButton,
  LxCard,
  LxConfirmationModal,
  LxEmptyState,
  LxIconButton,
  LxInput,
  LxModal,
  LxPageHeader,
  LxSelect,
  LxSpinner,
} from '@/design-system'
import InviteCodeCard from './components/InviteCodeCard.vue'
import { useGroupsStore } from '../state/useGroupsStore'
import { useStudentsStore } from '@/modules/students/state/useStudentsStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const route = useRoute()
const router = useRouter()
const store = useGroupsStore()
const students = useStudentsStore()
const languages = useLanguagesStore()
const { notify } = useNotify()

const groupId = computed(() => String(route.params.id))
const group = computed(() => store.get(groupId.value))
const members = computed(() => (group.value?.studentIds ?? []).map(id => ({ id, name: students.nameOf(id) })))
const addable = computed(() =>
  students.students.filter(s => !group.value?.studentIds.includes(s.id)).map(s => ({ value: s.id, label: s.name })),
)

const isLoading = ref(true)
const isRegenerating = ref(false)
const addStudentId = ref<string | null>(null)
const pendingRemove = ref<{ id: string; name: string } | null>(null)
const isDeleteOpen = ref(false)
const isRenameOpen = ref(false)
const newName = ref('')

onMounted(async () => {
  await Promise.all([store.load(), students.load(), languages.load()])
  isLoading.value = false
})

const regenerate = async () => {
  isRegenerating.value = true
  try {
    await store.regenerateCode(groupId.value)
  } catch (e) {
    notify(errorMessage(e, 'Не удалось обновить код'), 'error')
  } finally {
    isRegenerating.value = false
  }
}

const addStudent = async () => {
  if (!addStudentId.value) return
  try {
    await store.addStudent(groupId.value, addStudentId.value)
    addStudentId.value = null
  } catch (e) {
    notify(errorMessage(e, 'Не удалось добавить ученика'), 'error')
  }
}

const removeStudent = async () => {
  if (!pendingRemove.value) return
  try {
    await store.removeStudent(groupId.value, pendingRemove.value.id)
  } catch (e) {
    notify(errorMessage(e, 'Не удалось убрать ученика'), 'error')
  }
}

const rename = async () => {
  if (!newName.value.trim()) return
  try {
    await store.rename(groupId.value, newName.value)
    isRenameOpen.value = false
  } catch (e) {
    notify(errorMessage(e, 'Не удалось переименовать'), 'error')
  }
}

const removeGroup = async () => {
  try {
    await store.remove(groupId.value)
    router.replace('/groups')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось удалить группу'), 'error')
  }
}
</script>

<template>
  <div class="page">
    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!group" title="Группа не найдена">
      <LxButton @click="router.replace('/groups')">К группам</LxButton>
    </LxEmptyState>

    <template v-else>
      <LxPageHeader back="/groups" :title="group.name"
        :subtitle="group.languageId ? `${languages.flag(group.languageId)} ${languages.label(group.languageId)}` : undefined">
        <template #actions>
          <LxIconButton label="Переименовать" variant="surface" @click="newName = group.name; isRenameOpen = true">
            <Pencil :size="20" />
          </LxIconButton>
          <LxIconButton label="Удалить группу" variant="surface" @click="isDeleteOpen = true"><Trash2 :size="20" /></LxIconButton>
        </template>
      </LxPageHeader>

      <InviteCodeCard :code="group.inviteCode" :loading="isRegenerating" :title="`Код группы «${group.name}»`"
        hint="Ученик вводит код и подтверждает подключение. Новые участники получают активные задания группы."
        @generate="regenerate" />

      <div class="row actions">
        <LxButton @click="router.push({ path: '/assignments', query: { group: group.id } })">
          <ClipboardList :size="20" /> Назначить набор
        </LxButton>
        <LxButton variant="secondary" @click="router.push({ path: '/teacher/stats', query: { group: group.id } })">
          <BarChart3 :size="20" /> Статистика группы
        </LxButton>
      </div>

      <section class="section">
        <h2 class="section-title">Ученики ({{ members.length }})</h2>
        <div v-if="addable.length" class="add-row">
          <LxSelect v-model="addStudentId" :options="addable" placeholder="Добавить подключённого ученика" />
          <LxButton variant="secondary" :disabled="!addStudentId" @click="addStudent"><UserPlus :size="20" /></LxButton>
        </div>
        <LxEmptyState v-if="!members.length" compact title="В группе пока никого" description="Раздайте код группы ученикам." />
        <LxCard v-else padding="none">
          <ul class="members">
            <li v-for="m in members" :key="m.id">
              <a :href="`/students/${m.id}`" @click.prevent="router.push(`/students/${m.id}`)">{{ m.name }}</a>
              <LxIconButton label="Убрать из группы" variant="danger" @click="pendingRemove = m">
                <UserMinus :size="20" />
              </LxIconButton>
            </li>
          </ul>
        </LxCard>
      </section>

      <LxConfirmationModal :visible="!!pendingRemove" title="Убрать из группы?"
        :message="`${pendingRemove?.name} останется вашим учеником, но выйдет из группы.`" confirm-text="Убрать"
        variant="danger" @update:visible="v => !v && (pendingRemove = null)" @confirm="removeStudent" />

      <LxConfirmationModal v-model:visible="isDeleteOpen" title="Удалить группу?"
        message="Ученики останутся подключены к вам, задания сохранятся." confirm-text="Удалить" variant="danger"
        @confirm="removeGroup" />

      <LxModal v-model:visible="isRenameOpen" title="Название группы" size="sm">
        <LxInput v-model="newName" label="Название" />
        <template #footer>
          <LxButton variant="secondary" @click="isRenameOpen = false">Отмена</LxButton>
          <LxButton :disabled="!newName.trim()" @click="rename">Сохранить</LxButton>
        </template>
      </LxModal>
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

.actions {
  flex-wrap: wrap;
}

.add-row {
  display: flex;
  gap: var(--space-2);

  > :first-child {
    flex: 1;
  }
}

.members {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-5);
    font-weight: 800;

    & + li {
      border-top: 2px solid var(--color-border);
    }
  }

  a {
    color: var(--color-text-primary);
  }
}
</style>
