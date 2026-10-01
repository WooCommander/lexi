<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KeyRound, School, Baby } from 'lucide-vue-next'
import { LxButton, LxCard, LxInput, LxPageHeader } from '@/design-system'
import { InviteService } from '@/modules/groups/services/InviteService'
import type { InvitePreview } from '@/modules/groups/domain/Group'
import { LinkService } from '../services/LinkService'
import type { Profile } from '@/modules/auth/domain/User'
import { UserRole } from '@/modules/auth/domain/User'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const router = useRouter()
const auth = useAuthStore()
const study = useStudyStore()
const { notify } = useNotify()

const code = ref('')
const preview = ref<InvitePreview | null>(null)
const error = ref('')
const isBusy = ref(false)
const teachers = ref<Profile[]>([])
const parents = ref<Profile[]>([])

const loadMentors = async () => {
  if (!auth.userId) return
  ;[teachers.value, parents.value] = await Promise.all([
    LinkService.fetchMentors('teacher', auth.userId),
    LinkService.fetchMentors('parent', auth.userId),
  ])
}

onMounted(() => loadMentors().catch(console.error))

const check = async () => {
  error.value = ''
  preview.value = null
  if (!code.value.trim()) return
  isBusy.value = true
  try {
    preview.value = await InviteService.preview(code.value)
    if (!preview.value) error.value = 'Код не найден. Проверьте, нет ли опечатки.'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    isBusy.value = false
  }
}

const confirm = async () => {
  isBusy.value = true
  try {
    await InviteService.redeem(code.value)
    // код делает пользователя учеником, если он им ещё не был
    await auth.refreshAccount()
    auth.setActiveRole(UserRole.Student)
    notify('Подключено!', 'success')
    await study.load(true)
    router.push('/learn')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <div class="page page--narrow">
    <LxPageHeader back title="Подключиться по коду" subtitle="Код даёт учитель или родитель" />

    <LxCard class="stack">
      <form class="code-form" @submit.prevent="check">
        <LxInput v-model="code" label="Код приглашения" placeholder="ENG-7K4P" autocomplete="off" :error="error" />
        <LxButton type="submit" variant="secondary" :loading="isBusy && !preview">
          <KeyRound :size="20" /> Проверить
        </LxButton>
      </form>

      <LxCard v-if="preview" tone="soft" class="preview">
        <component :is="preview.kind === 'parent' ? Baby : School" :size="32" />
        <div>
          <div v-if="preview.groupName">Группа: <b>{{ preview.groupName }}</b></div>
          <div>{{ preview.kind === 'parent' ? 'Родитель' : 'Учитель' }}: <b>{{ preview.ownerName }}</b></div>
          <p class="caption">
            {{ preview.kind === 'parent'
              ? 'Родитель увидит ваш прогресс и сможет добавлять вам слова.'
              : 'Учитель увидит ваш прогресс и сможет назначать наборы слов.' }}
          </p>
        </div>
        <LxButton :loading="isBusy" @click="confirm">Подтвердить</LxButton>
      </LxCard>
    </LxCard>

    <section v-if="teachers.length || parents.length" class="section">
      <h2 class="section-title">Уже подключены</h2>
      <LxCard padding="sm" class="stack">
        <div v-for="t in teachers" :key="`t${t.id}`" class="row"><School :size="20" /> {{ t.name }} <span class="caption">учитель</span></div>
        <div v-for="p in parents" :key="`p${p.id}`" class="row"><Baby :size="20" /> {{ p.name }} <span class="caption">родитель</span></div>
      </LxCard>
    </section>
  </div>
</template>

<style scoped lang="scss">
.code-form {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);

  > :first-child {
    flex: 1;
  }

  > button {
    margin-top: 28px;
  }
}

.preview {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;

  > div {
    flex: 1;
    min-width: 200px;
  }
}
</style>
