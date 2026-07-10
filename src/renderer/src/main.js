import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initObservability } from './lib/observability.js'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
initObservability(app)
app.mount('#app')
