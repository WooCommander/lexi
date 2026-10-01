<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, School } from 'lucide-vue-next'
import { LxButton, LxCard, LxEmptyState, LxInput, LxModal, LxPageHeader, LxSelect, LxSpinner } from '@/design-system'
import { useGroupsStore } from '../state/useGroupsStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { pluralRu } from '@/shared/lib/plural'

const router = useRouter()
const store = useGroupsStore()
const languages = useLanguagesStore()
const { notify } = useNotify()

const isCreateOpen = ref(false)
const isCreating = ref(false)
const name = ref('')
const languageId = ref<string | null>(null)

onMounted(async () => {
  await languages.load()
  await store.load()
})

const openCreate = () => {
  name.value = ''
  languageId.value = languages.byCode.get('en')?.id ?? null
  isCreateOpen.value = true
}

const create = async () => {
  if (!name.value.trim()) return
  isCreating.value = true
  try {
    const group = await store.create(name.value, languageId.value ?? undefined)
    isCreateOpen.value = false
    router.push(`/groups/${group.id}`)
  } catch (e) {
    notify(errorMessage(e, 'Не удалось создать группу'), 'error')
  } finally {
    isCreating.value = false
  }
}

const studentsLabel = (n: number) => `${n} ${pluralRu(n, ['ученик', 'ученика', 'учеников'])}`
</script>

<template>
  <div class="page">
    <LxPageHeader title="Группы" subtitle="Классы и потоки — у каждой группы свой код приглашения">
      <template #actions>
        <LxButton @click="openCreate"><Plus :size="20" /> Новая группа</LxButton>
      </template>
    </LxPageHeader>

    <div v-if="store.isLoading && !store.groups.length" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!store.groups.length" title="Групп пока нет"
      description="Например: «6А — English» или «Romanian — индивидуальные».">
      <template #icon><School :size="36" /></template>
      <LxButton @click="openCreate"><Plus :size="20" /> Создать группу</LxButton>
    </LxEmptyState>

    <div v-else class="grid-cards">
      <LxCard v-for="g in store.groups" :key="g.id" interactive class="group" @click="router.push(`/groups/${g.id}`)">
        <div class="group__flag">{{ languages.flag(g.languageId) }}</div>
        <div class="group__name">{{ g.name }}</div>
        <div class="group__meta">
          <span class="caption">{{ studentsLabel(g.studentIds.length) }}</span>
          <code v-if="g.inviteCode" class="group__code">{{ g.inviteCode }}</code>
        </div>
      </LxCard>
    </div>

    <LxModal v-model:visible="isCreateOpen" title="Новая группа" size="sm">
      <form class="stack" @submit.prevent="create">
        <LxInput v-model="name" label="Название" placeholder="6А — English" />
        <LxSelect v-model="languageId" :options="languages.options" label="Язык" placeholder="Без языка" />
      </form>
      <template #footer>
        <LxButton variant="secondary" @click="isCreateOpen = false">Отмена</LxButton>
        <LxButton :disabled="!name.trim()" :loading="isCreating" @click="create">Создать</LxButton>
      </template>
    </LxModal>
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &__flag {
    font-size: 2rem;
    line-height: 1;
  }

  &__name {
    font-size: var(--text-h3);
    font-weight: 900;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__code {
    padding: 2px 8px;
    border-radius: 8px;
    background: var(--color-surface-2);
    font-weight: 800;
    letter-spacing: 0.05em;
  }
}
</style>
