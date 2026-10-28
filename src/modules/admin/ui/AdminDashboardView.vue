<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  LxBadge,
  LxBarChart,
  LxCard,
  LxHBarList,
  LxPageHeader,
  LxSegmented,
  LxSpinner,
  LxStatTile,
  LxStackedBar,
  type BarPoint,
  type HBarRow,
  type StackSegment,
} from '@/design-system'
import { AdminService } from '../services/AdminService'
import type {
  ActivityDay,
  AdminOverview,
  LanguageStat,
  LearnedBucket,
  PopularWord,
  SignupDay,
  TeacherStat,
  TopLearner,
} from '../domain/Admin'
import {
  avgLearnedPerStudent,
  avgStudentsPerTeacher,
  percentText,
  periodAccuracy,
  periodAnswers,
  teacherAccuracy,
  teacherActiveShare,
} from '../lib/dashboard'
import { compactNumber } from '@/shared/lib/numbers'
import { accuracy } from '@/modules/training/lib/DifficultWordsService'
import { formatDate, formatShortDate } from '@/shared/lib/dates'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

type Tab = 'overview' | 'students' | 'teachers'

const router = useRouter()
const { notify } = useNotify()

const tab = ref<Tab>('overview')
const days = ref(30)
const isLoading = ref(true)

const overview = ref<AdminOverview | null>(null)
const activity = ref<ActivityDay[]>([])
const signups = ref<SignupDay[]>([])
const distribution = ref<LearnedBucket[]>([])
const languages = ref<LanguageStat[]>([])
const popular = ref<PopularWord[]>([])
const top = ref<TopLearner[]>([])
const teachers = ref<TeacherStat[]>([])

const tabOptions = [
  { value: 'overview' as Tab, label: 'Обзор' },
  { value: 'students' as Tab, label: 'Ученики' },
  { value: 'teachers' as Tab, label: 'Учителя' },
]
const periodOptions = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
]

const loadPeriod = async () => {
  ;[activity.value, signups.value] = await Promise.all([AdminService.activity(days.value), AdminService.signups(days.value)])
}

onMounted(async () => {
  try {
    const [o, dist, langs, pop, topLearners, teacherStats] = await Promise.all([
      AdminService.overview(),
      AdminService.learnedDistribution(),
      AdminService.languageStats(),
      AdminService.popularWords(10),
      AdminService.topLearners(10),
      AdminService.teachers(),
      loadPeriod(),
    ])
    overview.value = o
    distribution.value = dist
    languages.value = langs
    popular.value = pop
    top.value = topLearners
    teachers.value = teacherStats
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить дашборд'), 'error')
  } finally {
    isLoading.value = false
  }
})

watch(days, async () => {
  try {
    await loadPeriod()
  } catch (e) {
    notify(errorMessage(e, 'Не удалось обновить период'), 'error')
  }
})

const byRole = (role: string) => overview.value?.byRole[role] ?? 0

// ---------- Обзор ----------
const activityPoints = computed<BarPoint[]>(() =>
  activity.value.map(d => ({
    label: formatShortDate(d.day),
    title: formatDate(d.day),
    values: { correct: d.correct, wrong: d.answers - d.correct },
  })),
)
const activeUsersPoints = computed<BarPoint[]>(() =>
  activity.value.map(d => ({ label: formatShortDate(d.day), title: formatDate(d.day), values: { users: d.activeUsers } })),
)
const signupPoints = computed<BarPoint[]>(() =>
  signups.value.map(d => ({
    label: formatShortDate(d.day),
    title: formatDate(d.day),
    values: { students: d.students, parents: d.parents, teachers: d.teachers },
  })),
)

// Цвет закреплён за ролью во всех графиках: ученик — 1, родитель — 2, учитель — 3, администратор — 4.
const roleSegments = computed<StackSegment[]>(() => [
  { key: 'student', label: 'Ученики', value: byRole('student'), color: 1 },
  { key: 'parent', label: 'Родители', value: byRole('parent'), color: 2 },
  { key: 'teacher', label: 'Учителя', value: byRole('teacher'), color: 3 },
  { key: 'admin', label: 'Администраторы', value: byRole('admin'), color: 4 },
])

// ---------- Ученики ----------
const distributionPoints = computed<BarPoint[]>(() =>
  distribution.value.map(b => ({ label: b.bucket, title: `Освоено слов: ${b.bucket}`, values: { students: b.students } })),
)

const topRows = computed<HBarRow[]>(() =>
  top.value.map(t => ({
    key: t.studentId,
    label: t.name,
    value: t.learned,
    display: `${t.learned} сл.`,
    sublabel: `точность ${percentText(accuracy(t.correct, t.wrong))} · ${compactNumber(t.correct + t.wrong)} ответов`,
  })),
)

const popularRows = computed<HBarRow[]>(() =>
  popular.value.map(w => ({
    key: w.itemId,
    label: `${w.sourceText} — ${w.targetText}`,
    value: w.answers,
    display: `${compactNumber(w.answers)} отв.`,
    sublabel: `${w.languageCode.toUpperCase()} · учеников: ${w.learners} · точность ${percentText(accuracy(w.correct, w.answers - w.correct))}`,
  })),
)

const languageRows = computed<HBarRow[]>(() =>
  languages.value.map(l => ({
    key: l.languageId,
    label: l.name,
    value: l.learned,
    display: `${compactNumber(l.learned)} сл.`,
    sublabel: `учеников: ${l.learners} · ответов за 30 дней: ${compactNumber(l.answers30d)}`,
  })),
)

// ---------- Учителя ----------
const teacherRows = computed<HBarRow[]>(() =>
  teachers.value.map(t => ({
    key: t.teacherId,
    label: t.name,
    value: t.learned,
    display: `${t.learned} сл.`,
    sublabel: `учеников: ${t.students} · групп: ${t.groups} · наборов: ${t.sets} · точность ${percentText(teacherAccuracy(t))}`,
  })),
)

const studentsPerTeacherPoints = computed<BarPoint[]>(() =>
  teachers.value.slice(0, 12).map(t => ({
    label: t.name.slice(0, 6),
    title: t.name,
    values: { students: t.students },
  })),
)

const open = (id: string) => router.push(`/admin/users/${id}`)
</script>

<template>
  <div class="page">
    <LxPageHeader title="Дашборд" subtitle="Показатели по всем пользователям приложения" />

    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <template v-else-if="overview">
      <div class="controls">
        <LxSegmented v-model="tab" :options="tabOptions" label="Раздел" />
        <LxSegmented v-if="tab === 'overview'" v-model="days" :options="periodOptions" label="Период" />
      </div>

      <!-- ===== Обзор ===== -->
      <template v-if="tab === 'overview'">
        <section class="grid-stats">
          <LxStatTile label="Пользователей" :value="overview.users" />
          <LxStatTile label="Активны за 7 дней" :value="overview.active7d" tone="primary" />
          <LxStatTile label="Ответов за 7 дней" :value="compactNumber(overview.answers7d)" tone="success" />
          <LxStatTile label="Освоено слов" :value="compactNumber(overview.learnedWords)" />
        </section>

        <LxCard class="stack">
          <h2 class="section-title">Кто пользуется</h2>
          <LxStackedBar :segments="roleSegments" chart-label="Пользователи по ролям" />
          <p class="caption">У одного человека может быть несколько ролей, поэтому сумма может быть больше числа пользователей.</p>
        </LxCard>

        <LxCard class="stack">
          <h2 class="section-title">
            Ответы за {{ days }} дн.
            <LxBadge tone="neutral">{{ compactNumber(periodAnswers(activity)) }}</LxBadge>
            <LxBadge tone="success">точность {{ percentText(periodAccuracy(activity)) }}</LxBadge>
          </h2>
          <LxBarChart :series="[{ key: 'correct', label: 'Верно', color: 3 }, { key: 'wrong', label: 'Ошибки', color: 2 }]"
            :points="activityPoints" chart-label="Ответы по дням" />
        </LxCard>

        <div class="two">
          <LxCard class="stack">
            <h2 class="section-title">Активные пользователи по дням</h2>
            <LxBarChart :series="[{ key: 'users', label: 'Пользователей', color: 1 }]" :points="activeUsersPoints"
              chart-label="Активные пользователи по дням" :height="150" />
          </LxCard>
          <LxCard class="stack">
            <h2 class="section-title">Новые пользователи</h2>
            <LxBarChart
              :series="[{ key: 'students', label: 'Ученики', color: 1 }, { key: 'parents', label: 'Родители', color: 2 }, { key: 'teachers', label: 'Учителя', color: 3 }]"
              :points="signupPoints" chart-label="Регистрации по дням" :height="150" />
            <p class="caption">Человек с несколькими ролями учитывается в каждой из них.</p>
          </LxCard>
        </div>

        <section class="grid-stats">
          <LxStatTile label="Слов в базе" :value="compactNumber(overview.vocabularyItems)" />
          <LxStatTile label="Наборов" :value="overview.wordSets" />
          <LxStatTile label="Групп" :value="overview.groups" />
          <LxStatTile label="Заданий" :value="overview.assignments" />
        </section>
      </template>

      <!-- ===== Ученики ===== -->
      <template v-else-if="tab === 'students'">
        <section class="grid-stats">
          <LxStatTile label="Учеников" :value="byRole('student')" />
          <LxStatTile label="Занимались за 7 дней" :value="overview.active7d" tone="primary" />
          <LxStatTile label="Слов освоено на ученика" :value="avgLearnedPerStudent(overview).toFixed(1)" tone="success" />
          <LxStatTile label="Точность за период" :value="percentText(periodAccuracy(activity))" />
        </section>

        <LxCard class="stack">
          <h2 class="section-title">Сколько слов освоили ученики</h2>
          <LxBarChart :series="[{ key: 'students', label: 'Учеников', color: 1 }]" :points="distributionPoints"
            chart-label="Распределение учеников по числу освоенных слов" :height="160" />
        </LxCard>

        <div class="two">
          <LxCard class="stack">
            <h2 class="section-title">Кто освоил больше всего слов</h2>
            <LxHBarList :rows="topRows" clickable @select="open" />
          </LxCard>
          <LxCard class="stack">
            <h2 class="section-title">Самые популярные слова</h2>
            <LxHBarList :rows="popularRows" :color="2" />
          </LxCard>
        </div>

        <LxCard class="stack">
          <h2 class="section-title">Языки</h2>
          <LxHBarList :rows="languageRows" :color="3" empty="Ответов по языкам пока нет" />
        </LxCard>
      </template>

      <!-- ===== Учителя ===== -->
      <template v-else>
        <section class="grid-stats">
          <LxStatTile label="Учителей" :value="byRole('teacher')" />
          <LxStatTile label="Групп" :value="overview.groups" tone="primary" />
          <LxStatTile label="Заданий" :value="overview.assignments" />
          <LxStatTile label="Учеников на учителя" :value="avgStudentsPerTeacher(teachers).toFixed(1)" tone="success" />
        </section>

        <div class="two">
          <LxCard class="stack">
            <h2 class="section-title">Чьи ученики освоили больше слов</h2>
            <LxHBarList :rows="teacherRows" clickable empty="Учителей пока нет" @select="open" />
          </LxCard>
          <LxCard class="stack">
            <h2 class="section-title">Учеников у учителей</h2>
            <LxBarChart :series="[{ key: 'students', label: 'Учеников', color: 1 }]" :points="studentsPerTeacherPoints"
              chart-label="Число учеников у каждого учителя" :height="160" />
          </LxCard>
        </div>

        <section v-if="teachers.length" class="section">
          <h2 class="section-title">Подробно</h2>
          <div class="lx-table-wrap">
            <table class="lx-table">
              <thead>
                <tr>
                  <th>Учитель</th><th class="num">Учеников</th><th class="num">Групп</th><th class="num">Наборов</th>
                  <th class="num">Заданий</th><th class="num">Освоено</th><th class="num">Точность</th>
                  <th class="num">Активны 7 дн.</th><th>Последняя активность</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in teachers" :key="t.teacherId" class="clickable" @click="open(t.teacherId)">
                  <td><b>{{ t.name }}</b></td>
                  <td class="num">{{ t.students }}</td>
                  <td class="num">{{ t.groups }}</td>
                  <td class="num">{{ t.sets }}</td>
                  <td class="num">{{ t.assignments }}</td>
                  <td class="num">{{ t.learned }}</td>
                  <td class="num">{{ percentText(teacherAccuracy(t)) }}</td>
                  <td class="num">{{ percentText(teacherActiveShare(t)) }}</td>
                  <td>{{ t.lastActive ? formatDate(t.lastActive) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
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

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.section-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
</style>
