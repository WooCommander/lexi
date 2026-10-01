<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { LxButton, LxCard, LxInput, LxModal, LxPageHeader } from '@/design-system'
import { useLanguagesStore } from '../state/useLanguagesStore'
import { languageLabel } from '../domain/Language'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const languages = useLanguagesStore()
const { notify } = useNotify()

const isOpen = ref(false)
const isSaving = ref(false)
const form = reactive({ code: '', name: '', nativeName: '', displayName: '', flag: '' })

onMounted(() => languages.load())

const open = () => {
  Object.assign(form, { code: '', name: '', nativeName: '', displayName: '', flag: '' })
  isOpen.value = true
}

const save = async () => {
  if (!form.code.trim() || !form.name.trim()) return
  isSaving.value = true
  try {
    const lang = await languages.create(form)
    notify(`Язык «${languageLabel(lang)}» добавлен`, 'success')
    isOpen.value = false
  } catch (e) {
    notify(errorMessage(e, 'Не удалось добавить язык'), 'error')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="page">
    <LxPageHeader title="Языки" subtitle="Новый язык добавляется без изменения структуры слов и статистики">
      <template #actions>
        <LxButton @click="open"><Plus :size="20" /> Добавить язык</LxButton>
      </template>
    </LxPageHeader>

    <div class="grid-cards">
      <LxCard v-for="l in languages.languages" :key="l.id" class="lang">
        <span class="lang__flag">{{ l.flag ?? '🌐' }}</span>
        <div>
          <div class="lang__name">{{ languageLabel(l) }}</div>
          <div class="caption">{{ l.code }} · {{ l.name }}<template v-if="l.nativeName"> · {{ l.nativeName }}</template></div>
        </div>
      </LxCard>
    </div>

    <LxModal v-model:visible="isOpen" title="Новый язык" size="sm">
      <form class="stack" @submit.prevent="save">
        <div class="pair">
          <LxInput v-model="form.code" label="Код (ISO 639-1)" placeholder="de" />
          <LxInput v-model="form.flag" label="Флаг" placeholder="🇩🇪" />
        </div>
        <LxInput v-model="form.name" label="Название (англ.)" placeholder="German" />
        <LxInput v-model="form.nativeName" label="Самоназвание" placeholder="Deutsch" />
        <LxInput v-model="form.displayName" label="Как показывать в интерфейсе" placeholder="Немецкий" />
      </form>
      <template #footer>
        <LxButton variant="secondary" @click="isOpen = false">Отмена</LxButton>
        <LxButton :disabled="!form.code.trim() || !form.name.trim()" :loading="isSaving" @click="save">Добавить</LxButton>
      </template>
    </LxModal>
  </div>
</template>

<style scoped lang="scss">
.lang {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  &__flag {
    font-size: 2.25rem;
  }

  &__name {
    font-weight: 900;
    font-size: var(--text-h3);
  }
}

.pair {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-3);
}
</style>
