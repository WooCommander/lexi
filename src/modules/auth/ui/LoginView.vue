<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Baby, GraduationCap, School } from 'lucide-vue-next'
import { LxButton, LxInput } from '@/design-system'
import { useNotify } from '@/shared/composables/useNotify'
import { isSupabaseConfigured } from '@/api/supabase'
import { useAuthStore } from '../state/useAuthStore'
import { ROLE_LABELS, UserRole } from '../domain/User'

type Mode = 'login' | 'register' | 'reset'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { notify } = useNotify()

const mode = ref<Mode>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const roles = ref<UserRole[]>([UserRole.Student])
const isSubmitting = ref(false)
const info = ref<string | null>(null)

const roleOptions = [
  { role: UserRole.Student, icon: GraduationCap, hint: 'Учу слова' },
  { role: UserRole.Parent, icon: Baby, hint: 'Слежу за ребёнком' },
  { role: UserRole.Teacher, icon: School, hint: 'Веду учеников' },
]

const title = computed(() => {
  if (auth.isRecoveryFlow) return 'Новый пароль'
  return { login: 'С возвращением!', register: 'Создать аккаунт', reset: 'Восстановить пароль' }[mode.value]
})

const toggleRole = (role: UserRole) => {
  roles.value = roles.value.includes(role) ? roles.value.filter(r => r !== role) : [...roles.value, role]
}

const switchMode = (next: Mode) => {
  mode.value = next
  auth.error = null
  info.value = null
}

const goAfterLogin = () => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  router.replace(redirect)
}

// Демо-аккаунты из db/05_demo.sql: в dev-режиме всегда, в сборке — если VITE_DEMO_LOGIN=true
const isDev = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === 'true'
const demoAccounts = [
  { role: UserRole.Student, email: 'demo.student@example.com' },
  { role: UserRole.Teacher, email: 'demo.teacher@example.com' },
  { role: UserRole.Parent, email: 'demo.parent@example.com' },
]

const demoLogin = async (account: (typeof demoAccounts)[number]) => {
  isSubmitting.value = true
  try {
    if (await auth.login(account.email, 'demo1234')) {
      auth.setActiveRole(account.role)
      goAfterLogin()
    } else {
      auth.error = 'Демо-аккаунт не найден — выполните db/05_demo.sql в Supabase'
    }
  } finally {
    isSubmitting.value = false
  }
}

const submit = async () => {
  isSubmitting.value = true
  info.value = null
  try {
    if (auth.isRecoveryFlow) {
      if (await auth.updatePassword(password.value)) {
        notify('Пароль обновлён', 'success')
        goAfterLogin()
      }
      return
    }
    if (mode.value === 'login') {
      if (await auth.login(email.value.trim(), password.value)) goAfterLogin()
      return
    }
    if (mode.value === 'register') {
      if (!roles.value.length) {
        auth.error = 'Выберите хотя бы одну роль'
        return
      }
      const result = await auth.register(email.value.trim(), password.value, name.value.trim(), roles.value)
      if (!result.success) return
      if (result.needsConfirmation) {
        info.value = 'Мы отправили письмо для подтверждения. Откройте его и затем войдите.'
        mode.value = 'login'
      } else {
        // активной делаем первую выбранную роль
        auth.setActiveRole(roles.value[0])
        goAfterLogin()
      }
      return
    }
    if (await auth.sendResetLink(email.value.trim())) {
      info.value = 'Ссылка для восстановления отправлена на почту.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <section class="login__hero" aria-hidden="true">
      <div class="hero-cards">
        <div class="hero-card hero-card--back">măr</div>
        <div class="hero-card hero-card--mid">яблуко</div>
        <div class="hero-card hero-card--front">
          <span class="hero-card__word">apple</span>
          <span class="hero-card__answer">яблоко</span>
        </div>
      </div>
      <h2 class="hero-title">Слова запоминаются,<br />когда их повторяешь вовремя</h2>
      <p class="hero-text">Карточки, интервальное повторение и прогресс, который видят ученик, родитель и учитель.</p>
    </section>

    <section class="login__panel">
      <div class="brand">
        <img src="/icon.svg" alt="" width="44" height="44" />
        <span>Lexi</span>
      </div>

      <h1 class="login__title">{{ title }}</h1>

      <p v-if="!isSupabaseConfigured" class="message message--error">
        Supabase не настроен: скопируйте <code>.env.example</code> в <code>.env</code> и укажите
        VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.
      </p>

      <form class="login__form" @submit.prevent="submit">
        <template v-if="auth.isRecoveryFlow">
          <LxInput v-model="password" label="Новый пароль" type="password" autocomplete="new-password" />
        </template>

        <template v-else>
          <LxInput v-if="mode === 'register'" v-model="name" label="Как вас зовут" placeholder="Алексей"
            autocomplete="name" />
          <LxInput v-model="email" label="Email" type="email" autocomplete="email" placeholder="you@example.com" />
          <LxInput v-if="mode !== 'reset'" v-model="password" label="Пароль" type="password"
            :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
            :hint="mode === 'register' ? 'Минимум 6 символов' : undefined" />

          <fieldset v-if="mode === 'register'" class="roles">
            <legend class="lx-field__label">Кто вы? Можно выбрать несколько</legend>
            <button v-for="o in roleOptions" :key="o.role" type="button" class="role-option"
              :class="{ active: roles.includes(o.role) }" :aria-pressed="roles.includes(o.role)" @click="toggleRole(o.role)">
              <component :is="o.icon" :size="26" />
              <span class="role-option__name">{{ ROLE_LABELS[o.role] }}</span>
              <span class="role-option__hint">{{ o.hint }}</span>
            </button>
          </fieldset>
        </template>

        <p v-if="auth.error" class="message message--error">{{ auth.error }}</p>
        <p v-if="info" class="message message--info">{{ info }}</p>

        <LxButton type="submit" size="lg" block :loading="isSubmitting">
          <template v-if="auth.isRecoveryFlow">Сохранить пароль</template>
          <template v-else-if="mode === 'login'">Войти</template>
          <template v-else-if="mode === 'register'">Зарегистрироваться</template>
          <template v-else>Отправить ссылку</template>
        </LxButton>
      </form>

      <div v-if="isDev && mode === 'login' && !auth.isRecoveryFlow" class="demo">
        <span class="caption">Демо-вход (пароль demo1234)</span>
        <div class="demo__buttons">
          <LxButton v-for="a in demoAccounts" :key="a.email" variant="secondary" size="sm" :disabled="isSubmitting"
            @click="demoLogin(a)">
            {{ ROLE_LABELS[a.role] }}
          </LxButton>
        </div>
      </div>

      <div v-if="!auth.isRecoveryFlow" class="login__links">
        <template v-if="mode === 'login'">
          <button class="link" @click="switchMode('register')">Нет аккаунта? Зарегистрироваться</button>
          <button class="link link--muted" @click="switchMode('reset')">Забыли пароль?</button>
        </template>
        <button v-else class="link" @click="switchMode('login')">Уже есть аккаунт? Войти</button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.login {
  min-height: 100dvh;
  display: grid;

  @media (min-width: 960px) {
    grid-template-columns: 1.1fr 1fr;
  }

  &__hero {
    display: none;

    @media (min-width: 960px) {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--space-4);
      padding: var(--space-7);
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
  }

  &__panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-5);
    width: 100%;
    max-width: 460px;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
  }

  &__title {
    font-size: var(--text-h1);
    font-weight: 900;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  &__links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.5rem;
  font-weight: 900;
}

.hero-cards {
  position: relative;
  height: 240px;
  margin-bottom: var(--space-5);
}

.hero-card {
  position: absolute;
  width: 260px;
  height: 170px;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 900;
  box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.35);

  &--back {
    left: 40px;
    top: 10px;
    background: var(--color-accent);
    color: var(--color-on-accent);
    transform: rotate(-12deg);
  }

  &--mid {
    left: 120px;
    top: 30px;
    background: #fff;
    color: var(--color-text-secondary);
    transform: rotate(6deg);
    opacity: 0.85;
  }

  &--front {
    left: 70px;
    top: 60px;
    background: #fff;
    color: #1F2430;
    transform: rotate(-2deg);
  }

  &__word {
    font-size: 2.25rem;
  }

  &__answer {
    font-size: 1.125rem;
    font-weight: 700;
    color: #0F8B77;
  }
}

.hero-title {
  color: inherit;
  font-size: 2.25rem;
  font-weight: 900;
}

.hero-text {
  max-width: 440px;
  font-size: 1.125rem;
  opacity: 0.9;
}

.roles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: none;

  legend {
    margin-bottom: var(--space-2);
  }
}

.role-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-3) var(--space-2);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;

  &__name {
    font-weight: 800;
    color: var(--color-text-primary);
  }

  &__hint {
    font-size: 0.75rem;
    text-align: center;
  }

  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
    color: var(--color-primary);
  }
}

.message {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-weight: 600;

  &--error {
    background: var(--color-error-soft);
    color: var(--color-error);
  }

  &--info {
    background: var(--color-primary-soft);
    color: var(--color-primary);
  }
}

.demo {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);

  &__buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
}

.link {
  min-height: 44px;
  border: none;
  background: none;
  color: var(--color-primary);
  font-weight: 800;
  cursor: pointer;

  &--muted {
    color: var(--color-text-secondary);
    font-weight: 600;
  }
}
</style>
