import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/main.scss'
import App from './App.vue'
import router from './app/router'
import { Capacitor } from '@capacitor/core'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')

if (!Capacitor.isNativePlatform() && import.meta.env.PROD) {
    import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
