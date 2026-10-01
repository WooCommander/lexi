<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Ellipsis, LogOut, Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '@/shared/composables/useTheme'
import { LxHaptics } from '@/shared/lib/haptics'
import { LxModal } from '@/design-system'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { ALL_ROLES, ROLE_LABELS, type UserRole } from '@/modules/auth/domain/User'
import { HOME_BY_ROLE, NAV_BY_ROLE, isNavActive, type NavItem } from '@/app/navigation'

defineProps<{ focus?: boolean }>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { isDark, toggleTheme } = useTheme()

const appVersion = __APP_VERSION__
const isMoreOpen = ref(false)

const navItems = computed<NavItem[]>(() => (auth.activeRole ? NAV_BY_ROLE[auth.activeRole] : []))
const mobileItems = computed(() => navItems.value.filter(i => i.mobile))
const moreItems = computed(() => navItems.value.filter(i => !i.mobile))
const myRoles = computed(() => ALL_ROLES.filter(r => auth.hasRole(r)))
const avatarLetter = computed(() => auth.displayName.charAt(0).toUpperCase() || '?')

const active = (item: NavItem) => isNavActive(item, route.path, navItems.value)
const isMoreActive = computed(() => moreItems.value.some(active))

const navigate = (path: string) => {
  LxHaptics.light()
  isMoreOpen.value = false
  if (route.path !== path) router.push(path)
}

const switchRole = (role: UserRole) => {
  if (role === auth.activeRole) return
  auth.setActiveRole(role)
  navigate(HOME_BY_ROLE[role])
}

const logout = async () => {
  isMoreOpen.value = false
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell" :class="{ 'is-focus': focus }">
    <!-- Sidebar (desktop / tablet landscape) -->
    <aside v-if="!focus" class="sidebar">
      <div class="brand" @click="navigate('/')">
        <img src="/icon.svg" alt="" class="brand__logo" />
        <span class="brand__name">Lexi</span>
        <span class="brand__version">v{{ appVersion }}</span>
      </div>

      <div v-if="myRoles.length > 1" class="role-switch" role="tablist" aria-label="Роль">
        <button v-for="r in myRoles" :key="r" class="role-switch__item" :class="{ active: r === auth.activeRole }"
          role="tab" :aria-selected="r === auth.activeRole" @click="switchRole(r)">
          {{ ROLE_LABELS[r] }}
        </button>
      </div>

      <nav class="side-nav">
        <a v-for="item in navItems" :key="item.path" class="side-nav__link" :class="{ active: active(item) }"
          :href="item.path" @click.prevent="navigate(item.path)">
          <component :is="item.icon" :size="22" />
          <span>{{ item.label }}</span>
        </a>
      </nav>

      <div class="sidebar__footer">
        <div class="me">
          <span class="me__avatar">{{ avatarLetter }}</span>
          <div class="me__info">
            <span class="me__name">{{ auth.displayName }}</span>
            <span class="me__role">{{ auth.activeRole ? ROLE_LABELS[auth.activeRole] : '' }}</span>
          </div>
        </div>
        <div class="row">
          <button class="footer-btn" :aria-label="isDark ? 'Светлая тема' : 'Тёмная тема'" @click="toggleTheme">
            <Sun v-if="isDark" :size="20" />
            <Moon v-else :size="20" />
          </button>
          <button class="footer-btn" aria-label="Выйти" @click="logout">
            <LogOut :size="20" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Top bar (mobile) -->
    <header v-if="!focus" class="topbar">
      <div class="brand" @click="navigate('/')">
        <img src="/icon.svg" alt="" class="brand__logo" />
        <span class="brand__name">Lexi</span>
      </div>
      <button v-if="myRoles.length > 1" class="topbar__role" @click="isMoreOpen = true">
        {{ auth.activeRole ? ROLE_LABELS[auth.activeRole] : '' }}
      </button>
      <button class="me__avatar me__avatar--btn" aria-label="Профиль" @click="navigate('/settings')">
        {{ avatarLetter }}
      </button>
    </header>

    <main class="content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>

    <!-- Bottom tabs (mobile) -->
    <nav v-if="!focus" class="tabbar">
      <a v-for="item in mobileItems" :key="item.path" class="tabbar__item" :class="{ active: active(item) }"
        :href="item.path" @click.prevent="navigate(item.path)">
        <span class="tabbar__icon"><component :is="item.icon" :size="22" /></span>
        <span class="tabbar__label">{{ item.label }}</span>
      </a>
      <button v-if="moreItems.length" class="tabbar__item" :class="{ active: isMoreActive }" @click="isMoreOpen = true">
        <span class="tabbar__icon"><Ellipsis :size="22" /></span>
        <span class="tabbar__label">Ещё</span>
      </button>
    </nav>

    <LxModal v-model:visible="isMoreOpen" title="Меню" size="sm">
      <div v-if="myRoles.length > 1" class="role-switch role-switch--sheet">
        <button v-for="r in myRoles" :key="r" class="role-switch__item" :class="{ active: r === auth.activeRole }"
          @click="switchRole(r)">
          {{ ROLE_LABELS[r] }}
        </button>
      </div>
      <nav class="side-nav">
        <a v-for="item in moreItems" :key="item.path" class="side-nav__link" :class="{ active: active(item) }"
          :href="item.path" @click.prevent="navigate(item.path)">
          <component :is="item.icon" :size="22" />
          <span>{{ item.label }}</span>
        </a>
        <button class="side-nav__link" @click="toggleTheme">
          <Sun v-if="isDark" :size="22" />
          <Moon v-else :size="22" />
          <span>{{ isDark ? 'Светлая тема' : 'Тёмная тема' }}</span>
        </button>
        <button class="side-nav__link side-nav__link--danger" @click="logout">
          <LogOut :size="22" />
          <span>Выйти</span>
        </button>
      </nav>
    </LxModal>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  min-height: 100dvh;

  @media (min-width: 900px) {
    display: grid;
    grid-template-columns: var(--sidebar-width) 1fr;

    &.is-focus {
      display: block;
    }
  }
}

.content {
  min-width: 0;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px));

  @media (min-width: 900px) {
    padding-bottom: 0;
  }

  .is-focus & {
    padding-bottom: 0;
  }
}

// --- Brand ---
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;

  &__logo {
    width: 36px;
    height: 36px;
  }

  &__name {
    font-size: 1.375rem;
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  &__version {
    font-size: var(--text-caption);
    font-weight: 700;
    color: var(--color-text-tertiary);
  }
}

// --- Sidebar ---
.sidebar {
  display: none;

  @media (min-width: 900px) {
    position: sticky;
    top: 0;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-5) var(--space-4);
    border-right: 2px solid var(--color-border);
    background: var(--color-surface);
  }

  &__footer {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
}

.role-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);

  &--sheet {
    margin-bottom: var(--space-4);
  }

  &__item {
    flex: 1;
    min-height: 40px;
    border: none;
    border-radius: 10px;
    background: transparent;
    font-size: var(--text-caption);
    font-weight: 800;
    color: var(--color-text-secondary);
    cursor: pointer;

    &.active {
      background: var(--color-surface);
      color: var(--color-primary);
      box-shadow: var(--shadow-1);
    }
  }
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__link {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-size);
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;

    &:hover {
      background: var(--color-surface-2);
      color: var(--color-text-primary);
    }

    &.active {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    &--danger:hover {
      background: var(--color-error-soft);
      color: var(--color-error);
    }
  }
}

.me {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;

  &__avatar {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 14px;
    background: var(--color-accent);
    color: var(--color-on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;

    &--btn {
      width: 44px;
      height: 44px;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__role {
    font-size: var(--text-caption);
    color: var(--color-text-tertiary);
  }
}

.footer-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: var(--color-surface-2);
  }
}

// --- Mobile top bar ---
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: calc(env(safe-area-inset-top, 0px) + 8px) var(--space-4) 8px;
  background: var(--color-surface-translucent);
  backdrop-filter: blur(12px);
  border-bottom: 2px solid var(--color-border);

  .brand {
    margin-right: auto;
  }

  &__role {
    min-height: 36px;
    padding: 0 12px;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    font-size: var(--text-caption);
    font-weight: 800;
    color: var(--color-primary);
    cursor: pointer;
  }

  @media (min-width: 900px) {
    display: none;
  }
}

// --- Mobile tab bar ---
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px));
  padding: 6px 6px env(safe-area-inset-bottom, 0px);
  background: var(--color-surface-translucent);
  backdrop-filter: blur(12px);
  border-top: 2px solid var(--color-border);

  @media (min-width: 900px) {
    display: none;
  }

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: none;
    background: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
  }

  &__icon {
    width: 52px;
    height: 32px;
    border-radius: var(--radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
  }

  &__label {
    font-size: 0.75rem;
    font-weight: 800;
  }

  &__item.active {
    color: var(--color-primary);

    .tabbar__icon {
      background: var(--color-primary-soft);
    }
  }
}
</style>
